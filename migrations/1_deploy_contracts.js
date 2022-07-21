const Auction = artifacts.require("Auction");
const Registry = artifacts.require("AuthorityRegistry")

module.exports = function(deployer, network, accounts) {
      // company and auction contract 
      const owner = accounts[0];
      // registry contract 
      const ASIC = accounts[9];

      const biddingEnds = 7; 
      const revealEnds = 7; 
      const claimEnds = 7; 

      deployer.then(async() => {
            await deployer.deploy(Registry, ASIC); 
            await deployer.deploy(Auction, Registry.address, owner, biddingEnds, revealEnds, claimEnds);    
      });
};

