const Auction = artifacts.require("Auction");
const Registry = artifacts.require("AuthorityRegistry");
const assert = require("chai").assert;
const timeMachine = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

let { investors } = require('../utilities/sorting.js');
const { addInvestor, createObject, sortObject, reshape } = require('../utilities/sorting.js');
const { generateCertificate, generateSignature, authorityKeys } = require('../utilities/certificate.js')


contract('Auction', (accounts) => {
	// contract ownder 
	const owner = accounts[0]; 
    const ASIC = accounts[9];
	// bidders/investors 
	const a = accounts[1]; 
    const b = accounts[2]; 
    const c = accounts[3]; 

    // certifying authority infromation: 
    // address and private key 
    let authorityAddress;
    let CA;

    // Investor A needs to store those details
    // and then use for verification purposes 
    let ownerConfirm_a; 
    let certificate_a; 
    let signature_a; 
	
    let year = 2022;
	let timeAdvance = 604800; 
	let auctionInstance; 	// contract 

    it('ASIC deploying registry contract', async () => {
        registryInstance = await Registry.deployed(); 
        await web3.eth.getBalance(registryInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
    });

    it('Company deploying constract', async () => {
		auctionInstance = await Auction.deployed();
		await web3.eth.getBalance(auctionInstance.address).then((balance) => {
			assert.equal(balance, 0, "check balance of contract"); 
		});
	}); 

    it('Owner issuing shares of the company', async () => {
		let total = await auctionInstance.balanceOf(owner); 
		assert.equal(total, 10000, "check number of shares issued"); 
	});

    it('ASIC adding public keys to the registry', async () => {
        CA = await authorityKeys(); // generate keys 
        authorityAddress = CA[0];
        await registryInstance.addPublicKey(authorityAddress, { from: ASIC }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
    });

    it('CA issuing certificate to investor A, and A placing blinded bids from his account', async () => {
        // addressASIC = await registryInstance.address; // contract address 
        // authority provides the string to the account owner and asks to sign
        let message_a = `The owner of ${a} address.`;
        let ownerSignature_a = await generateSignature(message_a, a); 
        // verify the owner and generate certificate
        let cert_b = await generateCertificate(a, message_a, ownerSignature_a, year, CA[1]); 
        certificate_a = cert_b[0]; 
        signature_a = cert_b[1]; 
        // create a signature to confirm ownership
        ownerConfirm_a = await web3.utils.soliditySha3(certificate_a, a); 

		await auctionInstance.placeBid(certificate_a, signature_a, ownerConfirm_a, "0x2e174c10e159ea99b867ce3205125c24a42d128804e4070ed6fcc8cc98166aa0", { from: a }); // 3, 4
		await auctionInstance.placeBid(certificate_a, signature_a, ownerConfirm_a, "0xc3a24b0501bd2c13a7e57f2db4369ec4c223447539fc0724a9d55ac4a06ebd4d", { from: a }); // 2, 3 

		const length = await auctionInstance.getBidsLength.call({ from: a }); // check the bids of a 
		assert.equal(length.words[0], 2, "check how many bids in the account after withdrawal"); 
	});

    it('CA issuing certificate to investor B signed by its private key', async () => {
        // authority provides the string to the account owner and asks to sign
        let message_b = `The owner of ${b} address.`;
        let ownerSignature_b = await generateSignature(message_b, b); 
        // verify the owner and generate certificate
        let cert_b = await generateCertificate(b, message_b, ownerSignature_b, year, CA[1]); 
        let certificate_b = cert_b[0]; 
        let signature_b = cert_b[1]; 
        // create a signature to confirm ownership
        let ownerConfirm_b = await web3.utils.soliditySha3(certificate_b, b); 

        await auctionInstance.placeBid(certificate_b, signature_b, ownerConfirm_b, "0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7", { from: b }); // 2, 4
		await auctionInstance.placeBid(certificate_b, signature_b, ownerConfirm_b, "0x405aad32e1adbac89bb7f176e338b8fc6e994ca210c9bb7bdca249b465942250", { from: b }); // 5, 3 
        await auctionInstance.placeBid(certificate_b, signature_b, ownerConfirm_b, "0xe2689cd4a84e23ad2f564004f1c9013e9589d260bde6380aba3ca7e09e4df40c", { from: b }); // 5, 1 

        const length = await auctionInstance.getBidsLength.call({ from: b }); // check the bids of a 
		assert.equal(length.words[0], 3, "check how many bids in the account after withdrawal"); 
    });

    it('Unsophisticated investor C tring to place bids with another investor certificate', async () => {
		await truffleAssert.fails(auctionInstance.placeBid(certificate_a, 
                                                           signature_a, 
                                                           ownerConfirm_a, 
                                                           "0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7", 
                                                           { from: c }),
                                  "Caller is not the certificate owner"); // 2, 4
	});

    it('Investor A revealing bids', async () => {
        // advance time to Round 2
		timeMachine.advanceTime(timeAdvance); 

		await auctionInstance.reveal([3, 2], [4, 3], { from: a, value: web3.utils.toWei("20", 'ether') });
        await auctionInstance.getPastEvents().then((ev) => addInvestor(ev, investors)); 
		// if bids revealed successfully, the bid hash is removed 
		await auctionInstance.getBid({ from: a }).then((exists) => {
			assert.equal(exists[1].bid, "0x0000000000000000000000000000000000000000000000000000000000000000", "check if bid was removed"); 
		}); 
	});

    it('Investor B revealing bids', async () => {
		await auctionInstance.reveal([2, 5, 5], [4, 3, 1], { from: b, value: web3.utils.toWei("28", 'ether') });
        await auctionInstance.getPastEvents().then((ev) => addInvestor(ev, investors)); 
		// if bids revealed successfully, the bid hash is removed 
		await auctionInstance.getBid({ from: a }).then((exists) => {
			assert.equal(exists[1].bid, "0x0000000000000000000000000000000000000000000000000000000000000000", "check if bid was removed"); 
		}); 
	});

    it('Company sorting the investors and sending sorted bids to blockchain', async () => {
        // advance time to after Round 2 
        timeMachine.advanceTime(timeAdvance);
		// sort all the investors and send them to the contract struct 
		investors.sort(sortObject);
        investors = reshape(); 
        await auctionInstance.loadInvestors(investors[0], investors[1], investors[2], investors[3], { from: owner }); 

		let request = await auctionInstance.getInvestors(0, { from: owner });
		assert.equal(request[0], investors[0][0], "check if first bid in contract is the highest"); 
	});

    it('Owner distributes shares to investors', async () => {
		await auctionInstance.distributeShares({ from: owner }); 

        let owner_balance = await auctionInstance.getSharesBalance({ from: owner });
		assert.equal(owner_balance.words[0], 9983, "check the balance after issued shares");
	});

    it('Investor A checks number of shares', async () => {
        let investorShares = await auctionInstance.getSharesBalance.call({ from: a });
        assert.equal(investorShares.words[0], 5, "check how many shares investor has"); 
    });

});