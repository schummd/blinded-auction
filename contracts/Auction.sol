// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Registry.sol"; 

contract NeverPayShares is ERC20 {
    
    bool internal locked;
    address payable company;            // to receive payments 
    uint256 biddingEnd; 
    uint256 revealEnd;
    uint256 claimEnd; 

    struct Investor {
        address bidder;                 // investor address 
        uint256 timestamp;              // time the bid was placed 
        uint256 shares;                 // number of shares purchased
        uint256 price;                  // price per share
        bool proofOfShares;
    }

    Investor[] investors;               // add investors' bids infromation 

    mapping(address => bytes32[]) internal proofOfReveal; 

    // creates 10,000 shares for the company 
    constructor() ERC20("NeverPay Tokens", "NPT") {
        _mint(msg.sender,  10000); 
    }

    event sharesSend(uint256 balance, address bidder, uint256 shares, uint256 refund, bool proof);
    event refundIssued(address bidder, uint256 refund); 

    // only owner can call the function 
    modifier onlyOwner(address _owner) { require(msg.sender == _owner); _; }
    // reveal bids only after this time 
    modifier onlyAfter(uint256 _time) { require(block.timestamp > _time); _; }
    // withdraw bids only before this time 
    modifier onlyBefore(uint256 _time) { require(block.timestamp < _time); _;}
    // lock against reentrancy 
    modifier lock() { 
        require(!locked); 
        locked = true; _; 
        locked = false;
    }

    /* COMPANY FUNCTIONS ----------------------------------------------------------------- */

    /**
     * @notice retrieves an investor from the array of investors 
     * @dev    can be called by anyone 
     * @param  _index requires an index of the invesotr in investors array 
     * @return address of the investor stored 
     * @return timestamp of the bid placed 
     * @return shares number of shares investor requested 
     * @return price price per share investor paid 
    **/
    function getInvestors(uint256 _index) public view returns(address, uint256, uint256, uint256) {
        return (investors[_index].bidder, investors[_index].timestamp, investors[_index].shares, investors[_index].price); 
    }


    /**
     * @notice loads sorted bids from off-chain to the investors array in a shape of Investor struct,
               performs additional checks to verify that the bid was actually revealed by taking the
               hash of values, and by verifying the insertion order to ensure bids are actually sorted
     * @dev    called externally 
     * @dev    called only by the company owner 
     * @dev    called only after reveal deadline ends 
     * @param  _bidder array of addresses
     * @param  _timestamp array of timestamps when the bid was originally placed
     * @param  _shares array of shares 
     * @param  _price array of prices 
    **/
    function loadInvestors(address[] memory _bidder, uint256[] memory _timestamp, uint256[] memory _shares, uint256[] memory _price) external onlyOwner(company) onlyAfter(revealEnd) lock() {
        uint256 length = _bidder.length; 
        for (uint256 i = 0; i < length; i++) {
            // generate hash with incoming infromation to check if it exists 
            bytes32 newHash = keccak256(abi.encodePacked(_bidder[i], _timestamp[i], _shares[i], _price[i])); 
            require(verifyBid(_bidder[i], newHash) == true && verifyOrder(_price[i], _timestamp[i]) == true, "Cannot verify the incoming bid: hash or order is wrong");
            investors.push(Investor(_bidder[i], _timestamp[i], _shares[i], _price[i], false));
        }
    }


    /**
     * @notice helper function to verify that the bid was actually revealed and 
               contrains correct values, checks if the has of the bid exists in 
               the proofOfReveal mapping 
     * @dev    called only internally 
     * @dev    called from loadInvestor when 
     * @param  _bidder address
     * @param  _bid the newly generate hash of incoming infromation 
     * @return bool true if such bid was revealed, false if no such bis exists 
    **/
    function verifyBid(address _bidder, bytes32 _bid) internal view returns(bool) {
        // get array of hashes for the incoming bidder and its length 
        bytes32[] memory proofs = proofOfReveal[_bidder]; 
        // if the hash in the array, then true else false
        // iterate over stored hashes and check if validates to the same hash 
        for (uint256 i = 0; i < proofs.length; i++) { if (proofs[i] == _bid) { return true; } }
        return false; 
    }


    /**
     * @notice helper function to verify the order at which bids are inserted, 
               works as verification and checks the last stored bid infromation 
               in investors array 
     * @dev    called only internally 
     * @dev    called from loadInvestor when bids are being loaded from off-chain 
     * @param  _price first sorting parameter 
     * @param  _timestamp second sorting parameter 
     * @return bool true if previous price is larger, false if not 
    **/
    function verifyOrder(uint256 _price, uint256 _timestamp) internal view returns(bool) {
        // first item to add
        if (investors.length == 0) { return true; }
        // find the last investor and compare its price and timestamp
        Investor storage previous = investors[investors.length - 1]; 
        // check conditions 
        if (previous.price >= _price) { return true; }
        if (previous.price == _price && previous.timestamp <= _timestamp) { return true; }
        return false; 
    }


    /**
     * @notice transfer shares to the investors based on sorted prices, if not 
               enough shares, the refund is send to the bidder for partial shares.
               Emits an event that confirms the shares have been sent to the bidder 
     * @dev    called externally 
     * @dev    called only by the company owner 
     * @dev    called only after reveal deadline ends 
     * @dev    using lock to prevent reentrancy 
    **/
    function distributeShares() external payable onlyOwner(company) onlyAfter(revealEnd) lock() {
        uint256 length = investors.length; 
        uint256 issuedShares; 
        uint256 refund; 
        
        for (uint256 i = 0; i < length; i++) {
            // check balance before proceeding 
            uint256 currentBalance = balanceOf(msg.sender);
            // is there are no more shares left, exit 
            if (currentBalance == 0) { break; }
            
            (address bidder, uint256 shares, uint256 price) = (investors[i].bidder, investors[i].shares, investors[i].price); 

            // check current amount of shares before each transfer 
            // and transfer shares 
            if (shares <= currentBalance) {
                transfer(bidder, shares);
                investors[i].proofOfShares = true; 
            }
            // when not enough balance, calculate how many shares can be issued
            // refund the remaining value to the bidder 
            if (shares > currentBalance) {
                issuedShares = shares - currentBalance; 
                transfer(bidder, issuedShares);
                investors[i].proofOfShares = true; 
                refund = (shares - issuedShares) * price; 
                payable(bidder).transfer(refund); 
            }
            emit sharesSend(currentBalance, bidder, shares, refund, investors[i].proofOfShares);
        }
    }

    
    /**
     * @notice after sorting, issuing shares and refunds, the company can claim the
               contract balance to transfer to their account 
     * @dev    called externally 
     * @dev    called only by the company owner 
     * @dev    called only after refund claim deadline ends 
    **/
    function transferPayment() external payable onlyOwner(company) onlyAfter(claimEnd) {
        company.transfer(address(this).balance); 
    }
}



contract Auction is NeverPayShares {

    address ASIC; 

    struct Bid {
        bytes32 bid;                    // blind bid 
        uint256 timestamp;              // time when bid was added 
    } 
    
    address[] bidders;                  // holds all the addresses who placed bid 
    mapping(address => Bid[]) bids;     // blinded bids 

    // set when bidding closes and bid revealed times, owner comapny address
    constructor(address _ASIC, address payable _company, uint256 _biddingTime, uint256 _revealTime, uint256 _claimEnds) payable {
        ASIC = _ASIC;
        company = _company; 
        biddingEnd = block.timestamp + (_biddingTime * 1 days); 
        revealEnd = biddingEnd + (_revealTime * 1 days); 
        claimEnd = revealEnd + (_claimEnds * 1 days); 
    }

    // sends the bids details off-chain 
    event bidDetails(address bidder, uint256 timestamp, uint256 shares, uint256 price); 

    /* BIDDER FUNCTIONS ------------------------------------------------------------------ */


    /**
     * @notice investor places blinded bid where bid is a hash of number of shares and price;
               verifies that the bidder who is placing the bid actually the address owner by 
               generating a new hash using provided certificate and address of the caller; 
               signature of the CA is recovered by the certificate and signature;
               signature then verified with ASIC 
     * @dev    called externally 
     * @dev    called only before bidding time ends 
     * @param  _cert investor's certificate signed by CA that he is sophisticated investor 
     * @param  _sig CA's signature for the certificate
     * @param  _owner owner signed certificate to prove that he is account owner 
     * @param  _blindedBid the hash of bid 
    **/
    function placeBid(bytes32 _cert, bytes memory _sig, bytes32 _owner, bytes32 _blindedBid) external onlyBefore(biddingEnd) {
        require(_owner == keccak256(abi.encodePacked(_cert, msg.sender)), "Caller is not the certificate owner");
        // derive the signer from provided certificate and verify 
        address signer = recoverSigner(_cert, _sig);
        require(verifyAuthority(signer) == true, "Investor is not sophisticated");
        // only authorised investors can place a bid 
        bids[msg.sender].push(Bid(_blindedBid, block.timestamp)); 
        bidders.push(msg.sender); 
    }


    /**
     * @notice retrieves a bid of a bidder by address
     * @dev    anyone can call  
     * @return Bids of the caller 
    **/
    function getBid() public view returns(Bid[] memory) {
        return bids[msg.sender]; 
    }


    /**
     * @notice helper functions used for testing off-chain 
     * @dev    anyone can call  
     * @return number of how many bids the caller has 
    **/
    // relevant only when all bids are related to one address 
    function getBidsLength() public view returns (uint256) {
        return bids[msg.sender].length; 
    }


    /**
     * @notice withdraw a specific bid placed by bidder using bid hash (the same when bid placed);
               iterate over all bids and find one matching bid hash to remove, once found, 
               delete it and move remaining bids up 
     * @dev    called externally 
     * @dev    called only before bidding time ends 
     * @param  _cert investor's certificate signed by CA that he is sophisticated investor 
     * @param  _owner owner signed certificate to prove that he is account owner 
     * @param  _ref bid hash to remove 
    **/
    function withdrawBid(bytes32 _cert, bytes32 _owner, bytes32 _ref) external onlyBefore(biddingEnd) {
        require(_owner == keccak256(abi.encodePacked(_cert, msg.sender)), "Caller is not the certificate owner");
        uint256 length = bids[msg.sender].length; 
        uint256 index; 
        for (uint256 i = 0; i < length; i++) {
            Bid storage bidCheck = bids[msg.sender][i]; 
            if (bidCheck.bid == _ref) {
                index = i;
                delete bids[msg.sender][i]; 
            }
        }
        for (uint256 j = index; j < length - 1; j++) {
            bids[msg.sender][j] = bids[msg.sender][j + 1];
        }
        bids[msg.sender].pop();
    }


    /**
     * @notice bidder reveal his bid by providing values to calculate the same hash 
               as was placed in Round 1; deposts full payment to the smart contract, 
               if the payment provided is larger than required, part of it is refunded;
               the function accessing each value provided in shares and price one by 
               one and emits revealed bid details off-chain for future sorting; 
               the function also records the hash of values and stores for verification
     * @dev    called externally 
     * @dev    called only after bidding time ends  
     * @dev    called only before reveal time ends 
     * @param  _shares an array of all shares placed as blinded bids: e.g., [1, 2, 3]
     * @param  _prices an array of all prices placed as blinded bids: e.g., [1, 2, 3]
    **/
    function reveal(uint256[] memory _shares, uint256[] memory _prices) external payable onlyAfter(biddingEnd) onlyBefore(revealEnd) {
        uint256 length = bids[msg.sender].length;
        uint256 requiredAmount; 
        uint256 refund; 
        
        require(length != 0, "Investor does not have bids");
        require(_shares.length == length, "Not all shares provided"); 
        require(_prices.length == length, "Not all prices provided"); 
        
        for (uint256 i = 0; i < length; i++) {
            Bid storage bidCheck = bids[msg.sender][i]; 
            (uint256 shares, uint256 price) = (_shares[i], _prices[i]); 

            require(price >= 1, "Price is less then 1 ether");
            require(msg.value > requiredAmount, "Not enough ehter for payment provided");

            // matching bid with provided values
            if (bidCheck.bid == keccak256(abi.encodePacked(shares, price))) {
                requiredAmount += (shares * price);
                proofOfReveal[msg.sender].push(keccak256(abi.encodePacked(msg.sender, bidCheck.timestamp, shares, price))); 
                emit bidDetails(msg.sender, bidCheck.timestamp, shares, price); 
                // after checks make it impossible for the bidder to pay again
                bidCheck.bid = bytes32(0);
            }
        }
        // calculatr refund for each share and send change
        if (msg.value > requiredAmount) { 
            refund = (msg.value / 1 ether) - requiredAmount; 
            payable(msg.sender).transfer(refund); 
        }
    }


    /* INVESTOR SHARES FUNCTIONS --------------------------------------------------------- */

    /**
     * @notice functions for investors to transfer shares to other addresses, checks the 
               current balance and transafers only when balance is more than 0 and shares
               to send is less or equal to balance 
     * @dev    called externally 
     * @dev    called only after reveal ends 
    **/
    function transferShares(address _to, uint256 _shares) external onlyAfter(revealEnd) {
        uint256 balance = balanceOf(msg.sender); 
        require(balance > 0 && balance >= _shares, "Not enough shares to transfer");
        transfer(_to, _shares);
    }


    /**
     * @notice functions for investors to check how many shares they current own 
     * @dev    called externally 
     * @dev    called only after reveal ends 
     * @return balance or number of shares investor has 
    **/
    function getSharesBalance() external view onlyAfter(revealEnd) returns(uint256) {
        return balanceOf(msg.sender);
    }


    /**
     * @notice function for investors to claim the refund for not issued shares 
     * @dev    called externally 
     * @dev    called only after reveal ends 
     * @dev    called only before claim ends 
     * @dev    using lock to prevent reentrancy 
    **/
    function claimRefund() external payable onlyAfter(revealEnd) onlyBefore(claimEnd) lock() {
        uint256 length = investors.length;
        uint256 refund; 
        for (uint256 i = 0; i < length; i++) {
            // for the bids that are set to false (did not receive shares)
            if (investors[i].bidder == msg.sender && investors[i].proofOfShares == false) {
                refund += (investors[i].shares * investors[i].price) * 1 ether;
                // set to true, so that bidder can't claim refund again 
                investors[i].proofOfShares = true;
            }
        }
        payable(msg.sender).transfer(refund); 
        emit refundIssued(msg.sender, refund / 1 ether);
    }


    /* COMPANY FUNCTIONS ----------------------------------------------------------------- */
    
    /**
     * @notice clears all bid commitments that has not been open or not payed
     * @dev    called externally 
     * @dev    called only after reveal ends 
     * @dev    called only by the owner 
    **/
    function removeInvalidBids() external onlyOwner(company) onlyAfter(revealEnd) { 
        uint256 length = bidders.length; 
        for (uint256 i = 0; i < length; i++) {
            delete bids[bidders[i]];
        }
        delete bidders; 
    }


    /* VERIFICATION FUNCTIONS ------------------------------------------------------------ */

    /**
     * @notice functions recovers the signer of the certificate from the provided certificate 
               (message signed by authority) and signature 
     * @dev    called internally from placeBid function  
     * @return signer address (authority who issued/signed the certificate to the bidder)
    **/
    // copyright: https://github.com/protofire/zeppelin-solidity/blob/master/contracts/ECRecovery.sol
    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns(address) {
        bytes32 r; bytes32 s; uint8 v;
        //Check the signature length
        if (sig.length != 65) { return (address(0)); }
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) { v += 27; }

        // If the version is correct return the signer address
        if (v != 27 && v != 28) { return (address(0)); } 
        else { return ecrecover(hash, v, r, s); }
    }

    /**
     * @notice functions to verify the signature of the signer and that is it registered 
               as authority with ASIC; function calles function checkPublicKey in Registry 
               contract 
     * @dev    called internally from placeBid function  
     * @return bool true if the signer is registered, false otherwise 
    **/
    function verifyAuthority(address _signer) internal view returns(bool) {
        AuthorityRegistry registry = AuthorityRegistry(ASIC);  
        return registry.checkPublicKey(_signer);
    }
}


