const { assert } = require("chai");


/**
 * Generates a random authority keys for testing 
 * @return {address} an address of the authority, ASIC can add to registry 
 * @return {privateKey} a private key of the authority, used to sign certificate
 */
async function authorityKeys() {
    let account = web3.eth.accounts.create();
    return [account["address"], account["privateKey"]]; 
};


/**
 * Generates an owner signature, address owner signs a message with his private key 
 * @return {string} signature of the owner 
 */
async function generateSignature(msg, address) {
    let signature = web3.eth.sign(msg, address); // signed with private key of account 
    return signature; 
}


/**
 * Generates a certificate: message signed by the authority private key 
 * @param  {address} investor address of the investor who needs certificate
 * @param  {string} msg message the authority need to sign 
 * @param  {string} signature a signature of the owner, generated when owner signed msg with private key 
 * @param  {number} year current year used in the string to sign 
 * @param  {privateKey} CAkey a private key of the signing authority 
 * @return {string} generate hash of the signed message (certificate)
 * @return {string} a signature of the authority for this certificaite 
 * @return {string} a plain test message that was signed 
 */
async function generateCertificate(investor, msg, signature, year, CAkey) {
    let recoveredAddress = web3.eth.accounts.recover(msg, signature);
    // check if recovered address of signer is the same as address of investor who requests cert
    assert.equal(recoveredAddress, investor, "the investor is not the account owner"); 
    // if the same, then owner is verified and certificate is issued 
    let data = `The owner of the address ${investor} is a sophisticated investor for year ${year}.`; 
    let cert = web3.eth.accounts.sign(data, CAkey);
    return [cert["messageHash"], cert["signature"], cert["message"]]; 
}



module.exports = { authorityKeys, generateSignature, generateCertificate };