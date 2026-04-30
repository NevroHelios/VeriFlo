#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, crypto::bn254::Fr, xdr::ToXdr, Address,
    Bytes, BytesN, Env, Vec,
};

mod token_interface {
    use soroban_sdk::{contractclient, Address, Env};

    #[allow(dead_code)]
    #[contractclient(name = "VflyTokenClient")]
    pub trait VflyTokenInterface {
        fn set_authorized(env: Env, id: Address, authorize: bool);
        fn mint(env: Env, to: Address, amount: i128);
    }
}

use token_interface::VflyTokenClient;

mod kyc_interface {
    use soroban_sdk::{contractclient, crypto::bn254::Fr, Bytes, Env, Vec};

    #[allow(dead_code)]
    #[contractclient(name = "KycVerifierClient")]
    pub trait KycVerifierInterface {
        fn verify(env: Env, proof_bytes: Bytes, pub_inputs: Vec<Fr>) -> bool;
    }
}

use kyc_interface::KycVerifierClient;

// Public input order (must match circuit output order):
// [0] nullifier         — Poseidon(nonce, recipient), replay guard
// [1] merkle_root       — commitment tree root, checked against trusted registry
// [2] min_accreditation — minimum tier required (circuit-enforced)
// [3] current_time      — Unix seconds at proof time (circuit-enforced expiry check)
// [4] recipient         — sha256(Address.toXDR())[0..31], wallet binding
const PUBLIC_INPUT_COUNT: u32 = 5;

#[contracttype]
pub enum DataKey {
    Admin,
    TokenContract,
    KycVerifier,
    MintAmount,
    TrustedRoot(BytesN<32>),
    Nullifier(BytesN<32>),
    Status(Address),
}

#[contracttype]
#[derive(Debug, Clone, PartialEq)]
pub enum AuthStatus {
    Pending,
    Authorized,
}

#[contracterror]
#[derive(Debug, Clone, PartialEq)]
pub enum VerifierError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NullifierReused = 3,
    ProofInvalid = 4,
    AlreadyAuthorized = 5,
    Unauthorized = 6,
    UntrustedRoot = 7,
    MalformedInputs = 8,
    RecipientMismatch = 9,
    InvalidTimestamp = 10,
}

#[contract]
pub struct VerifloVerifier;

// Ledger TTL constants (~30-day lifetime, extend when less than 1/5 remains).
const BUMP_AMOUNT: u32 = 518_400;
const BUMP_THRESHOLD: u32 = 100_000;

#[contractimpl]
impl VerifloVerifier {
    pub fn initialize(
        env: Env,
        admin: Address,
        token_contract: Address,
        kyc_verifier: Address,
        mint_amount: i128,
    ) -> Result<(), VerifierError> {
        if env.storage().instance().has(&DataKey::TokenContract) {
            return Err(VerifierError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);
        env.storage()
            .instance()
            .set(&DataKey::KycVerifier, &kyc_verifier);
        env.storage()
            .instance()
            .set(&DataKey::MintAmount, &mint_amount);
        Ok(())
    }

    pub fn add_trusted_root(env: Env, root: BytesN<32>) -> Result<(), VerifierError> {
        Self::get_admin(&env)?.require_auth();
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        let key = DataKey::TrustedRoot(root);
        // Store unit value — we only ever check existence via `has`.
        env.storage().persistent().set(&key, &());
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
        Ok(())
    }

    pub fn remove_trusted_root(env: Env, root: BytesN<32>) -> Result<(), VerifierError> {
        Self::get_admin(&env)?.require_auth();
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        env.storage()
            .persistent()
            .remove(&DataKey::TrustedRoot(root));
        Ok(())
    }

    pub fn is_trusted_root(env: Env, root: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::TrustedRoot(root))
    }

    /// proof: 256-byte Groth16 proof (A||B||C)
    /// pub_inputs: [nullifier(32B), merkle_root(32B), min_accreditation(32B), current_time(32B), recipient_as_fr(32B)]
    pub fn verify_and_authorize(
        env: Env,
        proof: Bytes,
        pub_inputs: Vec<BytesN<32>>,
        user: Address,
    ) -> Result<bool, VerifierError> {
        user.require_auth();

        // ── Phase 1: cheap stateless checks (fail without touching storage) ────────
        if pub_inputs.len() != PUBLIC_INPUT_COUNT {
            return Err(VerifierError::MalformedInputs);
        }
        if proof.len() != 256 {
            return Err(VerifierError::ProofInvalid);
        }

        let nullifier: BytesN<32> = pub_inputs.get(0).unwrap();
        let merkle_root: BytesN<32> = pub_inputs.get(1).unwrap();
        let current_time_bytes: BytesN<32> = pub_inputs.get(3).unwrap();
        let recipient: BytesN<32> = pub_inputs.get(4).unwrap();

        // current_time is the last 8 bytes of the 32-byte field element.
        let ct_arr = current_time_bytes.to_array();
        let current_time_input = u64::from_be_bytes([
            ct_arr[24], ct_arr[25], ct_arr[26], ct_arr[27],
            ct_arr[28], ct_arr[29], ct_arr[30], ct_arr[31],
        ]);
        let ledger_time = env.ledger().timestamp();
        if current_time_input.abs_diff(ledger_time) > 300 {
            return Err(VerifierError::InvalidTimestamp);
        }

        if recipient != Self::recipient_field(&env, &user) {
            return Err(VerifierError::RecipientMismatch);
        }

        // ── Phase 2: storage existence checks (`has` avoids deserialization) ───────
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);

        let storage = env.storage().persistent();
        let status_key = DataKey::Status(user.clone());
        if storage.has(&status_key) {
            return Err(VerifierError::AlreadyAuthorized);
        }
        if !storage.has(&DataKey::TrustedRoot(merkle_root)) {
            return Err(VerifierError::UntrustedRoot);
        }
        let nullifier_key = DataKey::Nullifier(nullifier);
        if storage.has(&nullifier_key) {
            return Err(VerifierError::NullifierReused);
        }

        // ── Phase 3: expensive cross-contract pairing check ────────────────────────
        let kyc_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::KycVerifier)
            .ok_or(VerifierError::NotInitialized)?;

        let mut fr_inputs: Vec<Fr> = Vec::new(&env);
        for input in pub_inputs.iter() {
            fr_inputs.push_back(Fr::from_bytes(input));
        }
        if !KycVerifierClient::new(&env, &kyc_address).verify(&proof, &fr_inputs) {
            return Err(VerifierError::ProofInvalid);
        }

        // ── Phase 4: writes (only reached on success) ──────────────────────────────
        storage.set(&nullifier_key, &());
        storage.extend_ttl(&nullifier_key, BUMP_THRESHOLD, BUMP_AMOUNT);

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .ok_or(VerifierError::NotInitialized)?;
        let mint_amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MintAmount)
            .ok_or(VerifierError::NotInitialized)?;
        let token_client = VflyTokenClient::new(&env, &token_address);
        token_client.set_authorized(&user, &true);
        token_client.mint(&user, &mint_amount);

        storage.set(&status_key, &AuthStatus::Authorized);
        storage.extend_ttl(&status_key, BUMP_THRESHOLD, BUMP_AMOUNT);

        Ok(true)
    }

    pub fn get_status(env: Env, user: Address) -> AuthStatus {
        env.storage()
            .persistent()
            .get(&DataKey::Status(user))
            .unwrap_or(AuthStatus::Pending)
    }

    pub fn token_contract(env: Env) -> Result<Address, VerifierError> {
        env.storage()
            .instance()
            .get(&DataKey::TokenContract)
            .ok_or(VerifierError::NotInitialized)
    }

    pub fn admin(env: Env) -> Result<Address, VerifierError> {
        Self::get_admin(&env)
    }

    fn get_admin(env: &Env) -> Result<Address, VerifierError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VerifierError::NotInitialized)
    }

    fn recipient_field(env: &Env, user: &Address) -> BytesN<32> {
        let digest = env.crypto().sha256(&user.clone().to_xdr(env)).to_array();
        let mut field = [0u8; 32];
        field[1..32].copy_from_slice(&digest[..31]);
        BytesN::from_array(env, &field)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Bytes, BytesN, Env, String, Vec};

    mod token_wasm {
        soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/vfly_token.wasm");
    }

    #[contract]
    pub struct MockKycVerifier;

    #[contractimpl]
    impl MockKycVerifier {
        pub fn verify(_env: Env, proof_bytes: Bytes, pub_inputs: Vec<Fr>) -> bool {
            proof_bytes.len() == 256
                && proof_bytes.get(0).unwrap_or(0) == 0x2a
                && pub_inputs.len() == PUBLIC_INPUT_COUNT
        }
    }

    fn make_proof(env: &Env, len: u32) -> Bytes {
        let mut bytes = Bytes::new(env);
        for i in 0u32..len {
            bytes.push_back(if i == 0 { 0x2a } else { (i % 256) as u8 });
        }
        bytes
    }

    fn make_invalid_kyc_proof(env: &Env) -> Bytes {
        let mut bytes = Bytes::new(env);
        for i in 0u32..256 {
            bytes.push_back((i % 256) as u8);
        }
        bytes
    }

    fn make_root(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn make_pub_inputs(
        env: &Env,
        nullifier: BytesN<32>,
        root: BytesN<32>,
        user: &Address,
    ) -> Vec<BytesN<32>> {
        let mut v: Vec<BytesN<32>> = Vec::new(env);
        v.push_back(nullifier);
        v.push_back(root);
        v.push_back(BytesN::from_array(env, &[0u8; 32])); // min_accreditation
        v.push_back(BytesN::from_array(env, &[0u8; 32])); // current_time
        v.push_back(VerifloVerifier::recipient_field(env, user));
        v
    }

    fn setup(env: &Env) -> (Address, Address, Address, Address) {
        env.mock_all_auths();

        let token_id = env.register(token_wasm::WASM, ());
        let kyc_id = env.register(MockKycVerifier, ());
        let verifier_id = env.register(VerifloVerifier, ());
        let admin = Address::generate(env);

        let token_client = token_wasm::Client::new(env, &token_id);
        token_client.initialize(
            &verifier_id,
            &7,
            &String::from_str(env, "VeriFlo"),
            &String::from_str(env, "VFLY"),
        );

        let verifier_client = VerifloVerifierClient::new(env, &verifier_id);
        verifier_client.initialize(&admin, &token_id, &kyc_id, &1_000_000_000i128);

        (token_id, kyc_id, verifier_id, admin)
    }

    #[test]
    fn test_get_status_pending_before_auth() {
        let env = Env::default();
        env.mock_all_auths();
        let token_id = Address::generate(&env);
        let kyc_id = Address::generate(&env);
        let admin = Address::generate(&env);
        let verifier_id = env.register(VerifloVerifier, ());
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        verifier_client.initialize(&admin, &token_id, &kyc_id, &1_000_000_000i128);

        let user = Address::generate(&env);
        assert_eq!(verifier_client.get_status(&user), AuthStatus::Pending);
    }

    #[test]
    fn test_proof_wrong_length_rejected() {
        let env = Env::default();
        let (_, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let user = Address::generate(&env);
        let nullifier = make_root(&env, 0x01);
        let pub_inputs = make_pub_inputs(&env, nullifier, root, &user);

        let short_proof = make_proof(&env, 10);
        let result = verifier_client.try_verify_and_authorize(&short_proof, &pub_inputs, &user);
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_public_input_count_rejected() {
        let env = Env::default();
        let (_, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let user = Address::generate(&env);
        let mut pub_inputs: Vec<BytesN<32>> = Vec::new(&env);
        pub_inputs.push_back(make_root(&env, 0x01));
        pub_inputs.push_back(root);

        let result =
            verifier_client.try_verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);
        assert!(result.is_err());
    }

    #[test]
    fn test_untrusted_root_rejected() {
        let env = Env::default();
        let (_, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let user = Address::generate(&env);
        let nullifier = make_root(&env, 0x01);
        let unknown_root = make_root(&env, 0xFF);
        let pub_inputs = make_pub_inputs(&env, nullifier, unknown_root, &user);

        let result =
            verifier_client.try_verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);
        assert!(result.is_err());
    }

    #[test]
    fn test_failed_kyc_verification_rejected() {
        let env = Env::default();
        let (token_id, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        let token_client = token_wasm::Client::new(&env, &token_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let nullifier = make_root(&env, 0x01);
        let user = Address::generate(&env);
        let pub_inputs = make_pub_inputs(&env, nullifier, root, &user);

        let result = verifier_client.try_verify_and_authorize(
            &make_invalid_kyc_proof(&env),
            &pub_inputs,
            &user,
        );
        assert!(result.is_err());
        assert_eq!(token_client.balance(&user), 0);
    }

    #[test]
    fn test_replay_nullifier_rejected() {
        let env = Env::default();
        let (_, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let nullifier = make_root(&env, 0x01);

        let user = Address::generate(&env);
        let pub_inputs = make_pub_inputs(&env, nullifier.clone(), root.clone(), &user);
        verifier_client.verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);

        let user2 = Address::generate(&env);
        let replay_inputs = make_pub_inputs(&env, nullifier, root, &user2);
        let result = verifier_client.try_verify_and_authorize(
            &make_proof(&env, 256),
            &replay_inputs,
            &user2,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_mints_tokens() {
        let env = Env::default();
        let (token_id, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        let token_client = token_wasm::Client::new(&env, &token_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let nullifier = make_root(&env, 0x01);
        let user = Address::generate(&env);
        let pub_inputs = make_pub_inputs(&env, nullifier, root, &user);

        let result =
            verifier_client.verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);
        assert_eq!(result, true);
        assert_eq!(token_client.balance(&user), 1_000_000_000);
    }

    #[test]
    fn test_proof_for_different_wallet_rejected() {
        let env = Env::default();
        let (token_id, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        let token_client = token_wasm::Client::new(&env, &token_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let proof_owner = Address::generate(&env);
        let attacker = Address::generate(&env);
        let nullifier = make_root(&env, 0x01);
        let pub_inputs = make_pub_inputs(&env, nullifier, root, &proof_owner);

        let result = verifier_client.try_verify_and_authorize(
            &make_proof(&env, 256),
            &pub_inputs,
            &attacker,
        );
        assert!(result.is_err());
        assert_eq!(token_client.balance(&attacker), 0);
    }

    #[test]
    fn test_double_auth_rejected() {
        let env = Env::default();
        let (_, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let user = Address::generate(&env);
        let n1 = make_root(&env, 0x01);
        let pub_inputs1 = make_pub_inputs(&env, n1, root.clone(), &user);
        verifier_client.verify_and_authorize(&make_proof(&env, 256), &pub_inputs1, &user);

        let n2 = make_root(&env, 0x02);
        let pub_inputs2 = make_pub_inputs(&env, n2, root, &user);
        let result =
            verifier_client.try_verify_and_authorize(&make_proof(&env, 256), &pub_inputs2, &user);
        assert!(result.is_err());
    }

    #[test]
    fn test_add_trusted_root_requires_admin_auth() {
        let env = Env::default();
        let token_id = Address::generate(&env);
        let kyc_id = Address::generate(&env);
        let admin = Address::generate(&env);
        let verifier_id = env.register(VerifloVerifier, ());
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        verifier_client.initialize(&admin, &token_id, &kyc_id, &1_000_000_000i128);

        let result = verifier_client.try_add_trusted_root(&make_root(&env, 0x01));
        assert!(result.is_err());
    }
}
