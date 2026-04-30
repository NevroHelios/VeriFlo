#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec};

#[contracttype]
pub enum DataKey {
    Admin,
    Root(BytesN<32>),
    RootList,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum RegistryError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    RootAlreadyExists = 4,
    RootNotFound = 5,
}

const BUMP_AMOUNT: u32 = 518_400;
const BUMP_THRESHOLD: u32 = 100_000;

/// On-chain Merkle root registry.
/// Issuers publish their credential commitment tree roots here.
/// The veriflo-verifier checks submitted proof's merkle_root against this registry.
#[contract]
pub struct CredentialRegistry;

#[contractimpl]
impl CredentialRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        let roots: Vec<BytesN<32>> = Vec::new(&env);
        env.storage().instance().set(&DataKey::RootList, &roots);
        Ok(())
    }

    pub fn add_root(env: Env, root: BytesN<32>) -> Result<(), RegistryError> {
        Self::get_admin(&env)?.require_auth();
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);

        let storage = env.storage().persistent();
        let key = DataKey::Root(root.clone());
        if storage.has(&key) {
            return Err(RegistryError::RootAlreadyExists);
        }
        storage.set(&key, &());
        storage.extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);

        let mut list: Vec<BytesN<32>> = env
            .storage()
            .instance()
            .get(&DataKey::RootList)
            .unwrap_or(Vec::new(&env));
        list.push_back(root);
        env.storage().instance().set(&DataKey::RootList, &list);

        Ok(())
    }

    pub fn remove_root(env: Env, root: BytesN<32>) -> Result<(), RegistryError> {
        Self::get_admin(&env)?.require_auth();
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);

        let storage = env.storage().persistent();
        let key = DataKey::Root(root.clone());
        if !storage.has(&key) {
            return Err(RegistryError::RootNotFound);
        }
        storage.remove(&key);

        let list: Vec<BytesN<32>> = env
            .storage()
            .instance()
            .get(&DataKey::RootList)
            .unwrap_or(Vec::new(&env));
        let mut new_list: Vec<BytesN<32>> = Vec::new(&env);
        for r in list.iter() {
            if r != root {
                new_list.push_back(r);
            }
        }
        env.storage().instance().set(&DataKey::RootList, &new_list);

        Ok(())
    }

    pub fn is_trusted(env: Env, root: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Root(root))
    }

    pub fn list_roots(env: Env) -> Vec<BytesN<32>> {
        env.storage()
            .instance()
            .get(&DataKey::RootList)
            .unwrap_or(Vec::new(&env))
    }

    pub fn admin(env: Env) -> Result<Address, RegistryError> {
        Self::get_admin(&env)
    }

    fn get_admin(env: &Env) -> Result<Address, RegistryError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(RegistryError::NotInitialized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, BytesN, Env};

    fn make_root(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    #[test]
    fn test_add_and_check_root() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CredentialRegistry, ());
        let client = CredentialRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.initialize(&admin);

        let root = make_root(&env, 0xab);
        assert!(!client.is_trusted(&root));
        client.add_root(&root);
        assert!(client.is_trusted(&root));
    }

    #[test]
    fn test_remove_root() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CredentialRegistry, ());
        let client = CredentialRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.initialize(&admin);
        let root = make_root(&env, 0xcd);
        client.add_root(&root);
        assert!(client.is_trusted(&root));
        client.remove_root(&root);
        assert!(!client.is_trusted(&root));
    }

    #[test]
    fn test_list_roots() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CredentialRegistry, ());
        let client = CredentialRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.initialize(&admin);
        client.add_root(&make_root(&env, 1));
        client.add_root(&make_root(&env, 2));
        assert_eq!(client.list_roots().len(), 2);
    }

    #[test]
    fn test_duplicate_root_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(CredentialRegistry, ());
        let client = CredentialRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);

        client.initialize(&admin);
        let root = make_root(&env, 0xef);
        client.add_root(&root);
        let result = client.try_add_root(&root);
        assert!(result.is_err());
    }

    #[test]
    fn test_add_root_requires_admin_auth() {
        // No mock_all_auths — auth checks are enforced
        let env = Env::default();
        let id = env.register(CredentialRegistry, ());
        let admin = Address::generate(&env);

        // initialize does not call require_auth
        let client = CredentialRegistryClient::new(&env, &id);
        client.initialize(&admin);

        // add_root calls admin.require_auth() — no auth mocked, must fail
        let result = client.try_add_root(&make_root(&env, 0x01));
        assert!(result.is_err());
    }
}
