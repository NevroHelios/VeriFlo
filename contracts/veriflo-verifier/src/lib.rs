#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Bytes, BytesN, Env,
};

mod token_interface {
    use soroban_sdk::{contractclient, Address, Env};

    #[contractclient(name = "VflyTokenClient")]
    pub trait VflyTokenInterface {
        fn set_authorized(env: Env, id: Address, authorize: bool);
        fn mint(env: Env, to: Address, amount: i128);
    }
}

use token_interface::VflyTokenClient;

#[contracttype]
pub enum DataKey {
    TokenContract,
    MintAmount,
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
}

#[contract]
pub struct VerifloVerifier;

#[contractimpl]
impl VerifloVerifier {
    pub fn initialize(
        env: Env,
        token_contract: Address,
        mint_amount: i128,
    ) -> Result<(), VerifierError> {
        if env.storage().instance().has(&DataKey::TokenContract) {
            return Err(VerifierError::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);
        env.storage()
            .instance()
            .set(&DataKey::MintAmount, &mint_amount);
        Ok(())
    }

    pub fn verify_and_authorize(
        env: Env,
        proof: Bytes,
        user: Address,
    ) -> Result<bool, VerifierError> {
        // 1. Check initialized
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

        // 2. User must sign their own claim
        user.require_auth();

        // 3. Check not already authorized
        let current_status: AuthStatus = env
            .storage()
            .persistent()
            .get(&DataKey::Status(user.clone()))
            .unwrap_or(AuthStatus::Pending);
        if current_status == AuthStatus::Authorized {
            return Err(VerifierError::AlreadyAuthorized);
        }

        // 4. Compute nullifier — sha256 returns Hash<32>, convert to BytesN<32>
        let nullifier: BytesN<32> = env.crypto().sha256(&proof).into();

        // 5. Check nullifier not reused
        if env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Nullifier(nullifier.clone()))
            .unwrap_or(false)
        {
            return Err(VerifierError::NullifierReused);
        }

        // 6. Mock ZK check: proof must be > 32 bytes
        if proof.len() <= 32 {
            return Err(VerifierError::ProofInvalid);
        }

        // 7. Store nullifier
        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(nullifier), &true);

        // 8 & 9. Cross-contract calls to token
        let token_client = VflyTokenClient::new(&env, &token_address);
        token_client.set_authorized(&user, &true);
        token_client.mint(&user, &mint_amount);

        // 10. Update status
        env.storage()
            .persistent()
            .set(&DataKey::Status(user), &AuthStatus::Authorized);

        // 11. Return success
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Bytes, Env, String};

    // Import token WASM — only available in test builds after `stellar contract build`
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

    fn setup_both(env: &Env) -> (Address, Address, Address) {
        env.mock_all_auths();

        // Register token contract using WASM
        let token_id = env.register(token_wasm::WASM, ());
        // Register verifier contract
        let verifier_id = env.register(VerifloVerifier, ());

        // Initialize token — verifier is the admin
        let token_client = token_wasm::Client::new(env, &token_id);
        token_client.initialize(
            &verifier_id,
            &7,
            &String::from_str(env, "VeriFlo"),
            &String::from_str(env, "VFLY"),
        );

        // Initialize verifier
        let verifier_client = VerifloVerifierClient::new(env, &verifier_id);
        verifier_client.initialize(&token_id, &1_000_000_000i128);

        let user = Address::generate(env);
        (token_id, verifier_id, user)
    }

    #[test]
    fn test_get_status_pending_before_auth() {
        let env = Env::default();
        env.mock_all_auths();
        let verifier_id = env.register(VerifloVerifier, ());
        let token_id = Address::generate(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        verifier_client.initialize(&token_id, &1_000_000_000i128);

        let user = Address::generate(&env);
        assert_eq!(verifier_client.get_status(&user), AuthStatus::Pending);
    }

    #[test]
    fn test_invalid_short_proof_rejected() {
        let env = Env::default();
        let (_, verifier_id, user) = setup_both(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let short_proof = make_proof(&env, 10);
        let result = verifier_client.try_verify_and_authorize(&short_proof, &user);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_valid_proof_mints_tokens() {
        let env = Env::default();
        let (token_id, verifier_id, user) = setup_both(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);
        let token_client = token_wasm::Client::new(&env, &token_id);

        let proof = make_proof(&env, 64);
        let result = verifier_client.verify_and_authorize(&proof, &user);
        assert_eq!(result, true);
        assert_eq!(token_client.balance(&user), 1_000_000_000);
    }

    #[test]
    fn test_replay_nullifier_rejected() {
        let env = Env::default();
        let (_, verifier_id, user) = setup_both(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        let proof = make_proof(&env, 64);
        verifier_client.verify_and_authorize(&proof, &user);

        // Different user, same proof bytes → nullifier already stored
        let user2 = Address::generate(&env);
        let result = verifier_client.try_verify_and_authorize(&proof, &user2);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_status_authorized_after_proof() {
        let env = Env::default();
        let (_, verifier_id, user) = setup_both(&env);
        let verifier_client = VerifloVerifierClient::new(&env, &verifier_id);

        assert_eq!(verifier_client.get_status(&user), AuthStatus::Pending);
        let proof = make_proof(&env, 64);
        verifier_client.verify_and_authorize(&proof, &user);
        assert_eq!(verifier_client.get_status(&user), AuthStatus::Authorized);
    }
}
