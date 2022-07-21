// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract AuthorityRegistry {

    // registry of public keys of organisations that are registered 
    // to issue certificates to investors 

    address organisation; // ASIC address as an owner of the contract 

    mapping(address => bool) public registry; 

    constructor(address _owner) {
        organisation = _owner; 
    }

    // only ASIC an call functions 
    modifier onlyASIC(address _owner) { require(msg.sender == _owner, "Only owner can call this"); _; }

    // ASIC adds pubic key to the registry 
    function addPublicKey(address _publicKey) public onlyASIC(organisation) returns(bool) {
        registry[_publicKey] = true; 
        return true; 
    }

    // ASIC removes public key from the registry 
    function deletePublicKey(address _publicKey) public onlyASIC(organisation) {
        delete registry[_publicKey];
    }

    // other contracts can call this and see if the given key in regestry 
    function checkPublicKey(address _publicKey) external view returns(bool) {
        if (registry[_publicKey]) { return true; }
        return false; 
    }

}