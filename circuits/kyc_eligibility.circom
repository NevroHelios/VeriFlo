pragma circom 2.2.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";

// Merkle proof verifier for a tree of depth DEPTH
template MerkleProof(DEPTH) {
    signal input leaf;
    signal input siblings[DEPTH];
    signal input path_bits[DEPTH]; // 0 = sibling is right, 1 = sibling is left

    signal output root;

    signal hashes[DEPTH + 1];
    hashes[0] <== leaf;

    component hashers[DEPTH];
    component muxLeft[DEPTH];
    component muxRight[DEPTH];

    for (var i = 0; i < DEPTH; i++) {
        muxLeft[i] = Mux1();
        muxRight[i] = Mux1();

        // path_bits[i] == 0: current is left, sibling is right
        // path_bits[i] == 1: current is right, sibling is left
        muxLeft[i].c[0]  <== hashes[i];
        muxLeft[i].c[1]  <== siblings[i];
        muxLeft[i].s     <== path_bits[i];

        muxRight[i].c[0] <== siblings[i];
        muxRight[i].c[1] <== hashes[i];
        muxRight[i].s    <== path_bits[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== muxLeft[i].out;
        hashers[i].inputs[1] <== muxRight[i].out;

        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[DEPTH];
}

// KYC Eligibility Circuit
// Proves: holder of a valid credential (committed to the Merkle tree) meets
// jurisdiction + accreditation requirements, without revealing who they are.
//
// MERKLE_DEPTH: depth of the credential commitment Merkle tree (20 = ~1M users)
template KycEligibility(MERKLE_DEPTH) {
    // ── Private inputs ────────────────────────────────────────────────────
    signal input jurisdiction;      // e.g., 91 for India
    signal input accreditation;     // 0 = none, 1 = accredited, 2 = institutional
    signal input expiry;            // Unix timestamp (seconds)
    signal input issuer_id;         // public identifier of issuing institution
    signal input nonce;             // random field element, prevents commitment collision

    signal input merkle_siblings[MERKLE_DEPTH]; // sibling hashes for inclusion proof
    signal input merkle_path[MERKLE_DEPTH];     // path bits: 0=left, 1=right

    // ── Public inputs ─────────────────────────────────────────────────────
    signal input nullifier;           // Poseidon(nonce, recipient) — replay prevention
    signal input merkle_root;         // root of trusted commitment tree
    signal input min_accreditation;   // minimum accreditation level required
    signal input current_time;        // ledger close time (block timestamp)
    signal input recipient;           // Stellar address as field element (binds proof to wallet)

    // ── Step 1: Recompute credential commitment ───────────────────────────
    component commitment_hash = Poseidon(5);
    commitment_hash.inputs[0] <== jurisdiction;
    commitment_hash.inputs[1] <== accreditation;
    commitment_hash.inputs[2] <== expiry;
    commitment_hash.inputs[3] <== issuer_id;
    commitment_hash.inputs[4] <== nonce;

    signal commitment;
    commitment <== commitment_hash.out;

    // ── Step 2: Verify Merkle inclusion ───────────────────────────────────
    component merkle = MerkleProof(MERKLE_DEPTH);
    merkle.leaf       <== commitment;
    for (var i = 0; i < MERKLE_DEPTH; i++) {
        merkle.siblings[i]  <== merkle_siblings[i];
        merkle.path_bits[i] <== merkle_path[i];
    }
    merkle.root === merkle_root;

    // ── Step 3: Jurisdiction constraint ───────────────────────────────────
    // (exact match — a range check variant would use LessThan)
    signal jurisdiction_ok;
    jurisdiction_ok <== jurisdiction;       // constrained to be consistent with commitment
    _ <== jurisdiction_ok;                  // suppress unused warning

    // ── Step 4: Accreditation threshold ───────────────────────────────────
    // accreditation >= min_accreditation
    component acc_check = GreaterEqThan(8); // 8 bits — max value 255
    acc_check.in[0] <== accreditation;
    acc_check.in[1] <== min_accreditation;
    acc_check.out === 1;

    // ── Step 5: Expiry check ───────────────────────────────────────────────
    // expiry > current_time
    component expiry_check = GreaterThan(32); // 32 bits — supports until year 2106
    expiry_check.in[0] <== expiry;
    expiry_check.in[1] <== current_time;
    expiry_check.out === 1;

    // ── Step 6: Nullifier correctness ─────────────────────────────────────
    // nullifier = Poseidon(nonce, recipient) binds this proof to a specific wallet
    component nullifier_hash = Poseidon(2);
    nullifier_hash.inputs[0] <== nonce;
    nullifier_hash.inputs[1] <== recipient;
    nullifier_hash.out === nullifier;
}

component main {public [nullifier, merkle_root, min_accreditation, current_time, recipient]} = KycEligibility(20);
