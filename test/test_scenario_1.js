const Auction = artifacts.require("Auction");
const Registry = artifacts.require("AuthorityRegistry");
const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const timeMachine = require('ganache-time-traveler');

let { investors } = require('../utilities/sorting.js');
const { addInvestor, createObject, sortObject, reshape } = require('../utilities/sorting.js');
const { generateCertificate, generateSignature, authorityKeys } = require('../utilities/certificate.js')


contract('Auction', (accounts) => {
	// contract owner 
	const owner = accounts[0]; 
	const ASIC = accounts[9];
	// bidders/investors 
	const a = accounts[1]; 
	const b = accounts[2]; 
	const c = accounts[3]; 
	const d = accounts[4]; 
	const e = accounts[5]; 

    // certifying authority infromation: 
    // address and private key 
    let authorityAddress;
    let CA;

	let certificate_d;
	let certificate_c; 
	let certificate_e;
	let ownerConfirm_d;
	let ownerConfirm_c;
	let ownerConfirm_e;

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

    it('ASIC adding an authority public key to the registry', async () => {
        CA = await authorityKeys(); // generate random account keys 
        authorityAddress = CA[0];	// authority private key 
        await registryInstance.addPublicKey(authorityAddress, { from: ASIC }); 
        let check = await registryInstance.checkPublicKey(authorityAddress); 
        assert.isTrue(check, "check if public key was added"); 
    });

	// ------------------------------------------------------------------------------------------------------------------------------------

	it('CA issuing certificate to investor A and A placing bids from his account', async () => {
		// authority provides the string to the account owner and asks to sign
		let message_a = `The owner of ${a} address.`;
		let ownerSignature_a = await generateSignature(message_a, a); 
		// verify the owner and generate certificate
		let cert_b = await generateCertificate(a, message_a, ownerSignature_a, year, CA[1]); 
		let certificate_a = cert_b[0]; 
		let signature_a = cert_b[1]; 
		// create a signature to confirm ownership
		let ownerConfirm_a = await web3.utils.soliditySha3(certificate_a, a); 
		
		await auctionInstance.placeBid(certificate_a, signature_a, ownerConfirm_a, "0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f", { from: a }); // 1, 1
		await auctionInstance.placeBid(certificate_a, signature_a, ownerConfirm_a, "0xd9d16d34ffb15ba3a3d852f0d403e2ce1d691fb54de27ac87cd2f993f3ec330f", { from: a }); // 2, 1 
		await auctionInstance.placeBid(certificate_a, signature_a, ownerConfirm_a, "0x7dfe757ecd65cbd7922a9c0161e935dd7fdbcc0e999689c7d31633896b1fc60b", { from: a }); // 3, 1

		const length = await auctionInstance.getBidsLength.call({ from: a }); // check the bids of a 
		assert.equal(length.words[0], 3, "check how many bids in the account after withdrawal"); 
	});

	it('CA issuing certificate to investor B and B placing bids from his account', async () => {
		let message_b = `The owner of ${b} address.`;
        let ownerSignature_b = await generateSignature(message_b, b); 
        // verify the owner and generate certificate
        let cert_b = await generateCertificate(b, message_b, ownerSignature_b, year, CA[1]); 
        let certificate_b = cert_b[0]; 
        let signature_b = cert_b[1]; 
        // create a signature to confirm ownership
        let ownerConfirm_b = await web3.utils.soliditySha3(certificate_b, b); 

		await auctionInstance.placeBid(certificate_b, signature_b, ownerConfirm_b, "0xd9d16d34ffb15ba3a3d852f0d403e2ce1d691fb54de27ac87cd2f993f3ec330f", { from: b }); // 2, 1
		await auctionInstance.placeBid(certificate_b, signature_b, ownerConfirm_b, "0xe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0", { from: b }); // 1, 2

		const length = await auctionInstance.getBidsLength.call({ from: b }); // check the bids of b
		assert.equal(length.words[0], 2, "check how many bids in the account after withdrawal"); 
	});

	it('CA issuing certificate to investor C and C placing bids from his account', async () => {
		let message_c = `The owner of ${c} address.`;
        let ownerSignature_c = await generateSignature(message_c, c); 
        // verify the owner and generate certificate
        let cert_c = await generateCertificate(c, message_c, ownerSignature_c, year, CA[1]); 
        certificate_c = cert_c[0]; 
        let signature_c = cert_c[1]; 
        // create a signature to confirm ownership
        ownerConfirm_c = await web3.utils.soliditySha3(certificate_c, c); 

		await auctionInstance.placeBid(certificate_c, signature_c, ownerConfirm_c, "0xe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0", { from: c }) // 1, 2 
		await auctionInstance.placeBid(certificate_c, signature_c, ownerConfirm_c, "0xc3a24b0501bd2c13a7e57f2db4369ec4c223447539fc0724a9d55ac4a06ebd4d", { from: c }) // 2, 3
		await auctionInstance.placeBid(certificate_c, signature_c, ownerConfirm_c, "0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f", { from: c }); // 1, 1
		
		const length = await auctionInstance.getBidsLength.call({ from: c }); // check the bids of c
		assert.equal(length.words[0], 3, "check how many bids in the account after withdrawal"); 
	});

	it('CA issuing certificate to investor D and D placing bids from his account', async () => {
		let message_d = `The owner of ${d} address.`;
		let ownerSignature_d = await generateSignature(message_d, d); 
        // verify the owner and generate certificate
        let cert_d = await generateCertificate(d, message_d, ownerSignature_d, year, CA[1]); 
        certificate_d = cert_d[0]; 
        let signature_d = cert_d[1]; 
        // create a signature to confirm ownership
        ownerConfirm_d = await web3.utils.soliditySha3(certificate_d, d); 

		await auctionInstance.placeBid(certificate_d, signature_d, ownerConfirm_d, "0x04cde762ef08b6b6c5ded8e8c4c0b3f4e5c9ad7342c88fcc93681b4588b73f05", { from: d }); // 5, 4
		await auctionInstance.placeBid(certificate_d, signature_d, ownerConfirm_d, "0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f", { from: d }); // 4, 4
		await auctionInstance.placeBid(certificate_d, signature_d, ownerConfirm_d, "0x405aad32e1adbac89bb7f176e338b8fc6e994ca210c9bb7bdca249b465942250", { from: d }); // 5, 3

		const length = await auctionInstance.getBidsLength.call({ from: d }); // check the bids of d
		assert.equal(length.words[0], 3, "check how many bids in the account after withdrawal"); 
	});

	it('CA issuing certificate to investor E and E placing bids from his account', async () => {
		let message_e = `The owner of ${e} address.`;
		let ownerSignature_e = await generateSignature(message_e, e); 
        // verify the owner and generate certificate
        let cert_e = await generateCertificate(e, message_e, ownerSignature_e, year, CA[1]); 
        certificate_e = cert_e[0]; 
        let signature_e = cert_e[1]; 
        // create a signature to confirm ownership
        ownerConfirm_e = await web3.utils.soliditySha3(certificate_e, e); 

		await auctionInstance.placeBid(certificate_e, signature_e, ownerConfirm_e, "0xa15bc60c955c405d20d9149c709e2460f1c2d9a497496a7f46004d1772c3054c", { from: e }); // 1, 3
		await auctionInstance.placeBid(certificate_e, signature_e, ownerConfirm_e, "0xd9d16d34ffb15ba3a3d852f0d403e2ce1d691fb54de27ac87cd2f993f3ec330f", { from: e }); // 2, 1
		await auctionInstance.placeBid(certificate_e, signature_e, ownerConfirm_e, "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c", { from: e }); // 2, 2
		await auctionInstance.placeBid(certificate_e, signature_e, ownerConfirm_e, "0x7dfe757ecd65cbd7922a9c0161e935dd7fdbcc0e999689c7d31633896b1fc60b", { from: e }); // 3, 1
		await auctionInstance.placeBid(certificate_e, signature_e, ownerConfirm_e, "0xa15bc60c955c405d20d9149c709e2460f1c2d9a497496a7f46004d1772c3054c", { from: e }); // 1, 3

		const length = await auctionInstance.getBidsLength.call({ from: e }); // check the bids of e
		assert.equal(length.words[0], 5, "check how many bids in the account after placing"); 
	});

	// ------------------------------------------------------------------------------------------------------------------------------------

	it('Investor D withdrawing 2 bids', async () => {
		await auctionInstance.withdrawBid(certificate_d, ownerConfirm_d, "0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f", { from: d }); // 4, 4
		await auctionInstance.withdrawBid(certificate_d, ownerConfirm_d, "0x405aad32e1adbac89bb7f176e338b8fc6e994ca210c9bb7bdca249b465942250", { from: d }); // 5, 3

		const length = await auctionInstance.getBidsLength.call({ from: d }); // check the bids of d after withdrawal 
		assert.equal(length, 1, "check how many bids in the account after withdrawal"); 
	});

	it('Investor C withdrawing 1 bid', async () => {
		await auctionInstance.withdrawBid(certificate_c, ownerConfirm_c, "0xe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0", { from: c }); // 1, 2

		const length = await auctionInstance.getBidsLength.call({ from: c }); // check the bids of c after withdrawal 
		assert.equal(length, 2, "check how many bids in the account after withdrawal"); 
	});

	it('Investor E withdrawing 1 bid', async () => {
		await auctionInstance.withdrawBid(certificate_e, ownerConfirm_e, "0xd9d16d34ffb15ba3a3d852f0d403e2ce1d691fb54de27ac87cd2f993f3ec330f", { from: e }); // 2, 1
		
		const length = await auctionInstance.getBidsLength.call({ from: e }); // check the bids of e after withdrawal 
		assert.equal(length, 4, "check how many bids in the account after withdrawal"); 
	});

	// ------------------------------------------------------------------------------------------------------------------------------------

	it('Investor A revealing bids', async () => {
		// advance to Round 2 
		timeMachine.advanceTime(timeAdvance); 

		await auctionInstance.reveal([1, 2, 3], [1, 1, 1], { from: a, value: web3.utils.toWei("10", 'ether')}); 
		await auctionInstance.getPastEvents().then((ev) => addInvestor(ev, investors)); 

		// if bids revealed successfully, the bid hash is removed 
		await auctionInstance.getBid({ from: a }).then((exists) => {
			assert.equal(exists[1].bid, "0x0000000000000000000000000000000000000000000000000000000000000000", "check if bid was removed"); 
		}); 
	});

	it('Inverstor B revealing bids', async () => {
		await auctionInstance.reveal([2, 1], [1, 2], { from: b, value: web3.utils.toWei("5", 'ether')});
		await auctionInstance.getPastEvents().then((ev) => addInvestor(ev, investors)); 
		// if bids revealed successfully, the bid hash is removed 
		await auctionInstance.getBid({ from: b }).then((exists) => {
			assert.equal(exists[1].bid, "0x0000000000000000000000000000000000000000000000000000000000000000", "check if bid was removed"); 
		}); 
	});

	it('Inverstor C revealing bids', async () => {
		await auctionInstance.reveal([2, 1], [3, 1], { from: c, value: web3.utils.toWei("7", 'ether')});
		await auctionInstance.getPastEvents().then((ev) => addInvestor(ev, investors)); 
		// if bids revealed successfully, the bid hash is removed 
		await auctionInstance.getBid({ from: c }).then((exists) => {
			assert.equal(exists[1].bid, "0x0000000000000000000000000000000000000000000000000000000000000000", "check if bid was removed"); 
		}); 
	});

	it('Inverstor E revealing bids', async () => {
		await auctionInstance.reveal([1, 2, 3, 1], [3, 2, 1, 3], { from: e, value: web3.utils.toWei("13", 'ether')});
		await auctionInstance.getPastEvents().then((ev) => addInvestor(ev, investors)); 
		
		await auctionInstance.getBid({ from: e }).then((exists) => {
			assert.equal(exists[0].bid, "0x0000000000000000000000000000000000000000000000000000000000000000", "check if bid was removed"); 
		});
	});

	// // ------------------------------------------------------------------------------------------------------------------------------------

	it('Owner removing all invalid bids', async () => {
		// advance time to:
		// now + 7 days + 7 days -> after reveal ends/round 2
		timeMachine.advanceTime(timeAdvance); 
		await auctionInstance.removeInvalidBids({ from: owner });
		
		// once the bids removed, bidders would not see any infromation 
		await auctionInstance.getBid({ from: a }).then((exists) => {
			assert.equal(exists.length, 0, "check if no bids after removing"); 
		});
	});

	it('Owner sorting the investors and sending sorted bids to chain', async () => {
		// sort all the investors and send them to the contract struct 
		investors.sort(sortObject);
		investors = reshape(); 
        await auctionInstance.loadInvestors(investors[0], investors[1], investors[2], investors[3], { from: owner }); 

		let request = await auctionInstance.getInvestors(0, { from: owner });
		assert.equal(request[0], investors[0][0], "check if first bid in contract is the highest"); 
	});

	it('Owner distributing shares to investors', async () => {
		await auctionInstance.distributeShares({ from: owner }); 
		// assuming the balance of the shares was 10,000 and 
		// total requested shares are 19, so the owner should have 
		// 9981 shares left 
		let owner_balance = await auctionInstance.getSharesBalance({ from: owner })
		assert.equal(owner_balance.words[0], 9981, "check the balance after issued shares")
	});

	it('Owner claiming balance of the contract', async () => {
		timeMachine.advanceTime(timeAdvance);

		let contractBalance = await web3.eth.getBalance(auctionInstance.address);
		let ownerBalance = await web3.eth.getBalance(owner);

		// owner initiates payment transfer to his account 
		await auctionInstance.transferPayment(); 
		let contractBalance_after = await web3.eth.getBalance(auctionInstance.address);
		assert.equal(contractBalance_after, 0, "check balance after owner withdraws");
	}); 

	it('Investor A transfering all shares to investor B', async () => {
		// check balance and then transfer 
		let a_balance = await auctionInstance.balanceOf(a); 
		let b_balance = await auctionInstance.balanceOf(b); 

		if (a_balance.words[0] > 0) {
			await auctionInstance.transferShares(b, a_balance, { from: a });
			let a_balance_after = await auctionInstance.balanceOf(a); 
			let b_balance_after = await auctionInstance.balanceOf(b); 

			assert.equal(a_balance_after.words[0], 0, "invest A transferred all shares");
			assert.isAbove(b_balance_after.words[0], b_balance.words[0], "invest B has more shares"); 
		}; 
	});
})
