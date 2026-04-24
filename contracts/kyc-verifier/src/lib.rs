#![no_std]
extern crate alloc;

mod vk_constants;

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Bytes, BytesN, Env, Vec,
    crypto::bn254::{Bn254G1Affine as G1, Bn254G2Affine as G2, Fr},
};

use vk_constants::vk as VK;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VerifierError {
    MalformedProof = 1,
    MalformedPublicInputs = 2,
    InvalidProof = 3,
}

// A Groth16 proof: A (G1, 64B) || B (G2, 128B) || C (G1, 64B) = 256 bytes
#[contracttype]
#[derive(Clone)]
pub struct Groth16Proof {
    pub a: G1,
    pub b: G2,
    pub c: G1,
}

const PROOF_SIZE: u32 = 256;
const G1_SIZE: u32 = 64;
const G2_SIZE: u32 = 128;

fn parse_proof(_env: &Env, proof_bytes: Bytes) -> Result<Groth16Proof, VerifierError> {
    if proof_bytes.len() != PROOF_SIZE {
        return Err(VerifierError::MalformedProof);
    }
    let a_bytes: BytesN<64> = proof_bytes
        .slice(0..G1_SIZE)
        .try_into()
        .map_err(|_| VerifierError::MalformedProof)?;
    let b_bytes: BytesN<128> = proof_bytes
        .slice(G1_SIZE..G1_SIZE + G2_SIZE)
        .try_into()
        .map_err(|_| VerifierError::MalformedProof)?;
    let c_bytes: BytesN<64> = proof_bytes
        .slice(G1_SIZE + G2_SIZE..)
        .try_into()
        .map_err(|_| VerifierError::MalformedProof)?;

    Ok(Groth16Proof {
        a: G1::from_bytes(a_bytes),
        b: G2::from_bytes(b_bytes),
        c: G1::from_bytes(c_bytes),
    })
}

fn load_vk(env: &Env) -> (G1, G2, G2, G2, Vec<G1>) {
    let alpha = G1::from_bytes(BytesN::from_array(env, &VK::VK_ALPHA));
    let beta  = G2::from_bytes(BytesN::from_array(env, &VK::VK_BETA));
    let gamma = G2::from_bytes(BytesN::from_array(env, &VK::VK_GAMMA));
    let delta = G2::from_bytes(BytesN::from_array(env, &VK::VK_DELTA));

    let ic_arrays: [&[u8; 64]; 6] = [
        &VK::VK_IC_0, &VK::VK_IC_1, &VK::VK_IC_2,
        &VK::VK_IC_3, &VK::VK_IC_4, &VK::VK_IC_5,
    ];
    let mut ic: Vec<G1> = Vec::new(env);
    for arr in ic_arrays.iter() {
        ic.push_back(G1::from_bytes(BytesN::from_array(env, *arr)));
    }

    (alpha, beta, gamma, delta, ic)
}

fn verify_groth16(
    env: &Env,
    proof: Groth16Proof,
    pub_inputs: Vec<Fr>,
) -> Result<bool, VerifierError> {
    let (alpha, beta, gamma, delta, ic) = load_vk(env);
    let bn = env.crypto().bn254();

    if pub_inputs.len() + 1 != ic.len() {
        return Err(VerifierError::MalformedPublicInputs);
    }

    // Accumulate: vk_x = IC[0] + sum(IC[i+1] * pub_inputs[i])
    let mut vk_x = ic.get(0).unwrap();
    for i in 0..pub_inputs.len() {
        let scalar = pub_inputs.get(i).unwrap();
        let term = bn.g1_mul(&ic.get(i + 1).unwrap(), &scalar);
        vk_x = bn.g1_add(&vk_x, &term);
    }

    // Pairing check: e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
    let neg_a = -proof.a;
    let g1s = soroban_sdk::vec![env, neg_a, alpha, vk_x, proof.c];
    let g2s = soroban_sdk::vec![env, proof.b, beta, gamma, delta];

    if bn.pairing_check(g1s, g2s) {
        Ok(true)
    } else {
        Err(VerifierError::InvalidProof)
    }
}

#[contract]
pub struct KycVerifier;

#[contractimpl]
impl KycVerifier {
    /// Verify a Groth16 proof.
    /// proof_bytes: 256-byte flat array (A||B||C)
    /// pub_inputs: [nullifier, merkle_root, min_accreditation, current_time, recipient] as Fr scalars
    pub fn verify(
        env: Env,
        proof_bytes: Bytes,
        pub_inputs: Vec<Fr>,
    ) -> Result<bool, VerifierError> {
        let proof = parse_proof(&env, proof_bytes)?;
        verify_groth16(&env, proof, pub_inputs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, Bytes};

    #[test]
    fn test_reject_malformed_proof_wrong_length() {
        let env = Env::default();
        let id = env.register(KycVerifier, ());
        let client = KycVerifierClient::new(&env, &id);

        let short = Bytes::from_slice(&env, &[0u8; 100]);
        let inputs: Vec<Fr> = Vec::new(&env);
        let result = client.try_verify(&short, &inputs);
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_wrong_public_input_count() {
        let env = Env::default();
        let id = env.register(KycVerifier, ());
        let client = KycVerifierClient::new(&env, &id);

        // Valid-length proof bytes but random garbage
        let proof_bytes = Bytes::from_slice(&env, &[0u8; 256]);
        // Wrong number of inputs (should be 5)
        let inputs: Vec<Fr> = Vec::new(&env);
        let result = client.try_verify(&proof_bytes, &inputs);
        assert!(result.is_err());
    }
}
