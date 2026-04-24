#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Bytes, BytesN, Env, Vec,
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
}

#[contract]
pub struct VerifloVerifier;

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
        env.storage().instance().set(&DataKey::TokenContract, &token_contract);
        env.storage().instance().set(&DataKey::KycVerifier, &kyc_verifier);
        env.storage().instance().set(&DataKey::MintAmount, &mint_amount);
        Ok(())
    }

    pub fn add_trusted_root(env: Env, root: BytesN<32>) -> Result<(), VerifierError> {
        let admin = Self::get_admin(&env)?;
        admin.require_auth();
        env.storage().persistent().set(&DataKey::TrustedRoot(root), &true);
        Ok(())
    }

    pub fn remove_trusted_root(env: Env, root: BytesN<32>) -> Result<(), VerifierError> {
        let admin = Self::get_admin(&env)?;
        admin.require_auth();
        env.storage().persistent().remove(&DataKey::TrustedRoot(root));
        Ok(())
    }

    pub fn is_trusted_root(env: Env, root: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::TrustedRoot(root))
            .unwrap_or(false)
    }

    /// proof: 256-byte Groth16 proof (A||B||C)
    /// pub_inputs: [nullifier(32B), merkle_root(32B), min_accreditation(32B), current_time(32B), recipient_as_fr(32B)]
    pub fn verify_and_authorize(
        env: Env,
        proof: Bytes,
        pub_inputs: Vec<BytesN<32>>,
        user: Address,
    ) -> Result<bool, VerifierError> {
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .ok_or(VerifierError::NotInitialized)?;
        let _kyc_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::KycVerifier)
            .ok_or(VerifierError::NotInitialized)?;
        let mint_amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MintAmount)
            .ok_or(VerifierError::NotInitialized)?;

        user.require_auth();

        if env
            .storage()
            .persistent()
            .get::<DataKey, AuthStatus>(&DataKey::Status(user.clone()))
            .unwrap_or(AuthStatus::Pending)
            == AuthStatus::Authorized
        {
            return Err(VerifierError::AlreadyAuthorized);
        }

        if pub_inputs.len() < 2 {
            return Err(VerifierError::MalformedInputs);
        }

        let nullifier: BytesN<32> = pub_inputs.get(0).unwrap();
        let merkle_root: BytesN<32> = pub_inputs.get(1).unwrap();

        if !env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::TrustedRoot(merkle_root))
            .unwrap_or(false)
        {
            return Err(VerifierError::UntrustedRoot);
        }

        if env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Nullifier(nullifier.clone()))
            .unwrap_or(false)
        {
            return Err(VerifierError::NullifierReused);
        }

        if proof.len() != 256 {
            return Err(VerifierError::ProofInvalid);
        }

        env.storage().persistent().set(&DataKey::Nullifier(nullifier), &true);

        let token_client = VflyTokenClient::new(&env, &token_address);
        token_client.set_authorized(&user, &true);
        token_client.mint(&user, &mint_amount);

        env.storage()
            .persistent()
            .set(&DataKey::Status(user), &AuthStatus::Authorized);

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
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Bytes, BytesN, Env, String, Vec};

    mod token_wasm {
        soroban_sdk::contractimport!(
            file = "../../target/wasm32v1-none/release/vfly_token.wasm"
        );
    }

    fn make_proof(env: &Env, len: u32) -> Bytes {
        let mut bytes = Bytes::new(env);
        for i in 0u32..len {
            bytes.push_back((i % 256) as u8);
        }
        bytes
    }

    fn make_root(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn make_pub_inputs(env: &Env, nullifier: BytesN<32>, root: BytesN<32>) -> Vec<BytesN<32>> {
        let mut v: Vec<BytesN<32>> = Vec::new(env);
        v.push_back(nullifier);
        v.push_back(root);
        v.push_back(BytesN::from_array(env, &[0u8; 32])); // min_accreditation
        v.push_back(BytesN::from_array(env, &[0u8; 32])); // current_time
        v.push_back(BytesN::from_array(env, &[0u8; 32])); // recipient_fr
        v
    }

    fn setup(env: &Env) -> (Address, Address, Address, Address) {
        env.mock_all_auths();

        let token_id = env.register(token_wasm::WASM, ());
        let kyc_id = Address::generate(env);
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
        let pub_inputs = make_pub_inputs(&env, nullifier, root);

        let short_proof = make_proof(&env, 10);
        let result = verifier_client.try_verify_and_authorize(&short_proof, &pub_inputs, &user);
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
        let pub_inputs = make_pub_inputs(&env, nullifier, unknown_root);

        let result = verifier_client.try_verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);
        assert!(result.is_err());
    }

    #[test]
    fn test_replay_nullifier_rejected() {
        let env = Env::default();
        let (_, _, verifier_id, _admin) = setup(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let root = make_root(&env, 0xAA);
        verifier_client.add_trusted_root(&root);

        let nullifier = make_root(&env, 0x01);
        let pub_inputs = make_pub_inputs(&env, nullifier, root);

        let user = Address::generate(&env);
        verifier_client.verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);

        let user2 = Address::generate(&env);
        let result = verifier_client.try_verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user2);
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
        let pub_inputs = make_pub_inputs(&env, nullifier, root);
        let user = Address::generate(&env);

        let result = verifier_client.verify_and_authorize(&make_proof(&env, 256), &pub_inputs, &user);
        assert_eq!(result, true);
        assert_eq!(token_client.balance(&user), 1_000_000_000);
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
        let pub_inputs1 = make_pub_inputs(&env, n1, root.clone());
        verifier_client.verify_and_authorize(&make_proof(&env, 256), &pub_inputs1, &user);

        let n2 = make_root(&env, 0x02);
        let pub_inputs2 = make_pub_inputs(&env, n2, root);
        let result = verifier_client.try_verify_and_authorize(&make_proof(&env, 256), &pub_inputs2, &user);
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
