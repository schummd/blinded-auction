
investors = []


/**
 * Adding a bid details of the currently revealed bid, reading infromation from 
 * the previously emitted event by the function 
 * @param  {object} event previously emitted event from the reveal function 
 */
async function addInvestor(event) {
    const obj = event; 
    bidder = createObject(obj);
    // add each bid separately
    for (let i = 0; i < bidder.length; i++) {
        investors.push(bidder[i]); 
    }
};


/**
 * Creates an object for each event emitted from reveal function 
 * adds bid infromation to the investor array by the provided fields 
 * @param  {object} event previously emitted event from the reveal function 
 * @return {array} an array of all the bids infromation in format: 
 *                 [{bidder_1, time_1, shares_1, price_1}, {...}, ...]
 */
function createObject(events) {
    let revealsLength = Object.keys(events).length;
    var investorBids = []

    for (let i = 0; i < revealsLength; i++) {
        let values = events[i].returnValues; 
        // one bid object 
        var oneBid = {}
        for (var key in values) {
            if (key == "bidder") { oneBid.bidder = values[key]; }
            if (key == "timestamp") { oneBid.timestamp = values[key]; }
            if (key == "shares") { oneBid.shares = values[key]; }
            if (key == "price") { oneBid.price = values[key]; }
        }
        investorBids.push(oneBid);
    }
    // returns bids for the bidder 
    return investorBids; 
}


/**
 * Sorts an investor object first by price in descending order and if the 
 * prices are equal, by the timestamp in ascending order 
 * @param  {object} a bid a for sorting 
 * @param  {object} b bid b for sorting 
 * @return {number} returns 0, 1, -1 based on sorting position
 */
function sortObject(a, b) {
    if ( a.price > b.price ){ return -1; }
    if ( a.price == b.price ) {
        if ( a.timestamp < b.timestamp ) { return -1; }
        if ( a.timestamp > b.timestamp ) { return 1; }}
    if ( a.price < b.price ){ return 1; }
    return 0;
}


/**
 * Helper function for reshape(), aims to change the orientation of the object 
 * @param  {array} array an objects array to be changed 
 * @return {array} array of addresses, time, shares, prices as nested array
 */
function zip(arrays) {
    return arrays[0].map(function(_,i){
        return arrays.map(function(array){return array[i]})
    });
}


/**
 * Changes the orientation of investors object to nested array 
 * that contains all addresses, time, shares and prices in format: 
 * [[address_1,...,address_n], [time_1,...,time_n], ...]
 * @returns {array} array with new orientation 
 */
function reshape() {
    let mapped = investors.map(Object.values);
    // investors = 
    return zip(mapped); 
}


module.exports = { investors, addInvestor, createObject, sortObject, reshape };