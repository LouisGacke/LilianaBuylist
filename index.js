const http = require('http');
const https = require('https');
const delay = require('delay');
const fs = require('fs');

var cardsNotAvailable = [];
getListByUser();

//initially find select card if we have already bought from them and cost is < £1 diffence than cheapest.
//next try build a % into how many cards a user has on offer and use them if % meets threshold.
// create 10000x shuffled arrays and try algorithm and pick best.
var optimiseResults = (cardMap) =>
{
  var currentBestBuyList;
  console.log(cardMap);
  for(var i = 0; i < 10000; i++)
  {
    var shuffled = shuffledMap(cardMap);
    var buyListResult = generateGroupedBuyList(shuffled);
    if (currentBestBuyList === undefined)
    {
      currentBestBuyList = buyListResult;
    }
    if (currentBestBuyList.price > buyListResult.price)
    {
      currentBestBuyList = buyListResult;
    }
  }

  cheapestEachCard(cardMap);
  //console.log(currentBestBuyList.buyList);
  for(var entry of currentBestBuyList.buyList.entries())
  {
    var key = entry[0];
    var value = entry[1];
    var totalPrice = 0.00;
    console.log("\t"+key+" => ");
    for (let index = 0; index < value.length; index++) 
    {
      let userOffers = value[index];
      totalPrice += parseFloat(userOffers.price);
      console.log("\t\tcard: "+userOffers.card+" , price : "+userOffers.price);
    }
    console.log("\t\t\tTotal price: "+(totalPrice+1));
  }
  
  console.log("Cost of buylist: £"+currentBestBuyList.price +" for "+cardMap.size+" cards, from "+currentBestBuyList.buyList.size+ " users.");
  console.log("Cards not available:");
  console.log(cardsNotAvailable);

  cardsByFewerSellers(cardMap);
}

var shuffledMap = (cardMap) => 
{
  var keyArray = Array.from(cardMap.keys());
  for (let i = keyArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keyArray[i], keyArray[j]] = [keyArray[j], keyArray[i]];
  }
  var shuffledMap = new Map();
  keyArray.forEach(key => 
  {
    shuffledMap.set(key, cardMap.get(key));  
  });
  return shuffledMap;
}

var cheapestEachCard = (cardMap) =>
{
  var buyList = new Map();
  var priceOfBuylist = 0.00;
  for(var entry of cardMap.entries())
  {
    var key = entry[0];
    var value = entry[1];
    if (buyList.get(value[0].user) !== undefined)
    {
      var usersOffers = buyList.get(value[0].user);
      usersOffers.push({card: key, price: value[0].price})
      buyList.set(value[0].user, usersOffers);
    }
    else
    {
      buyList.set(value[0].user, [{card: key, price: value[0].price}]);
    }
    
    priceOfBuylist+=parseFloat(value[0].price);
  }

  var postageForBuylist = 0.00;
  for(var entry of buyList.entries())
  {
    var key = entry[0];
    var value = entry[1];
    var totalPriceFromUser = 0;
    var postage = 1;
    for(var i = 0; i < value.length ; i++) 
    {
      if(value[i].price >= 20)
      {
        postage = 2.1;
        break;
      } 
      totalPriceFromUser += value[i].price;
      if (totalPriceFromUser >= 20)
      {
        postage = 2.1;
        break;
      }
    };
    postageForBuylist+=postage;
  }
  console.log(buyList);
  console.log(priceOfBuylist, postageForBuylist);
  console.log("Cost of Cheapest each card buylist: £"+(priceOfBuylist + postageForBuylist) +" for "+cardMap.size+" cards, from "+buyList.size+ " users.");
}

var generateGroupedBuyList = (cardMap) =>
{
  var buyList = new Map();
  var buyListRefined = new Map();
  var priceOfBuylist = 0.00;
  var priceOfBuylistRefined = 0.00;
  // BUG with first loop only using total -1 card
  for(var entry of cardMap.entries())
  {
    var key = entry[0];
    var value = entry[1];
    //Only 1 offer for a card
    if (value.length === 1)
    {
      //console.log("Must buy '" +key+ "' from "+value[0].user);
      if (buyList.get(value[0].user) !== undefined)
      {
        var usersOffers = buyList.get(value[0].user);
        usersOffers.push({card: key, price: value[0].price});
        buyList.set(value[0].user, usersOffers);
      }
      else
      {
        buyList.set(value[0].user, [{card: key, price: value[0].price}]);
      }
      priceOfBuylist+=parseFloat(value[0].price);
    }
    else
    {
      var bestValueOffer = value[0];
      var bestValueOfferAmountOfCards = (buyList.get(value[0].user) === undefined)? 1 : buyList.get(value[0].user).length;
      var bestValueOfferPostagePrice = (value[0].price >= 20)? 2.1 : 1;
      if (buyList.get(value[0].user) !== undefined)
      {
        buyList.get(value[0].user).forEach(offer => {
          if (offer.price >= 20) bestValueOfferPostagePrice = 2.1;
        });
      }
  
      for (var i = 0; i < value.length; i++)
      {
        // if offer is from current seller
        if (buyList.get(value[i].user) !== undefined)
        {
          var postageVal = 1;
          buyList.get(value[i].user).forEach(offer => 
          {
            if (offer.price >= 20) postageVal = 2.1;
          });
          // if new potential sellers postage+cost is less than original best offer + cost
          var currentPrice = parseFloat(value[i].price);
          var bestPrice = parseFloat(bestValueOffer.price);
          // console.log(key+": comparing current: £"+ (currentPrice+ (postageVal / buyList.get(value[i].user).length)) +" with best: £"+(bestPrice +
          // (bestValueOfferPostagePrice / bestValueOfferAmountOfCards)));
          if (currentPrice + (postageVal / buyList.get(value[i].user).length) < bestPrice +
            (bestValueOfferPostagePrice / bestValueOfferAmountOfCards))
          {
            bestValueOffer = value[i];
            bestValueOfferAmountOfCards = buyList.get(value[i].user).length+1
            bestValueOfferPostagePrice = postageVal;
          }
        }
      }
      // console.log("best cost for: "+key+" £"+bestValueOffer.price);
      var userBuyList = buyList.get(bestValueOffer.user);
      if (userBuyList !== undefined)
      {
        userBuyList.push({card: key, price: bestValueOffer.price});
      }
      else
      {
        userBuyList = [{card: key, price: bestValueOffer.price}];
      }
      priceOfBuylist+=parseFloat(bestValueOffer.price);
      buyList.set(bestValueOffer.user, userBuyList);
    }
  }
  // console.log(buyList);
  // search against buyers
  for(var entry of cardMap.entries())
  {
    var key = entry[0];
    //make sure the offers are in price order;
    var value = entry[1];
    // console.log(key);
    // console.log(buyListRefined);
    //Only 1 offer for a card
    if (value.length === 1)
    {
      //console.log("Must buy '" +key+ "' from "+value[0].user);
      if (buyListRefined.get(value[0].user) !== undefined)
      {
        var usersOffers = buyListRefined.get(value[0].user);
        usersOffers.push({card: key, price: value[0].price});
        buyListRefined.set(value[0].user, usersOffers);
      }
      else
      {
        buyListRefined.set(value[0].user, [{card: key, price: value[0].price}]);
      }

      priceOfBuylistRefined+=parseFloat(value[0].price);
    }
    else
    {
      var bestValueOffer = value[0];
      var bestValueOfferAmountOfCards = (buyListRefined.get(value[0].user) === undefined)? 0 : buyListRefined.get(value[0].user).length;
      // console.log("amount of cards from : "+value[0].user+" "+bestValueOfferAmountOfCards);
      var bestValueOfferPostagePrice = (value[0].price >= 20)? 2.1 : 1;
      for (var i = 0; i < value.length; i++)
      {
        //if offer is from current seller
        if (buyListRefined.get(value[i].user) !== undefined)
        {
          // console.log("already buying from seller: "+value[i].user);
          var postageVal = (bestValueOfferPostagePrice);
          if (postageVal !== 2.1)
          {
            buyListRefined.get(value[i].user).forEach(offer => 
              {
                if (offer.price >= 20) postageVal = 2.1;
              });
          }
          
          // if new potential sellers postage+cost is less than original best offer + cost
          var currentPrice = parseFloat(value[i].price);
          var bestPrice = parseFloat(bestValueOffer.price);
          // console.log(""+currentPrice +" + "+ (""+postageVal / (buyListRefined.get(value[i].user).length+1)) +" < "+ bestPrice +" + "+
          // (bestValueOfferPostagePrice / (bestValueOfferAmountOfCards+1)))
          if (currentPrice + (postageVal / (buyListRefined.get(value[i].user).length +1)) < bestPrice +
            (bestValueOfferPostagePrice / (bestValueOfferAmountOfCards+1)))
          {
            // console.log("New best offer!");
            bestValueOffer = value[i];
            // bestValueOfferAmountOfCards = buyListRefined.get(value[i].user).length+1
            // bestValueOfferPostagePrice = postageVal;
          }
        }
        else
        {
          // console.log("New seller: "+value[i].user);
          // if offer is from a seller we have chosen in a previous iteration
          if (buyList.get(value[i].user) !== undefined)
          {
            // console.log("bought from seller in previous algorithm");
            // console.log("amount of cards in previous algorithm from : "+value[i].user+" "+buyList.get(value[i].user).length);
            var postageVal = bestValueOfferPostagePrice / buyList.get(value[i].user).length;
            // if new potential sellers postage+cost is less than original best offer + cost
            var currentPrice = parseFloat(value[i].price);
            var bestPrice = parseFloat(bestValueOffer.price);
            // console.log(""+currentPrice +" + "+ (""+postageVal) +" < "+ bestPrice +" + "+
              // (bestValueOfferPostagePrice / (bestValueOfferAmountOfCards+1)))
            if (currentPrice + (postageVal) < bestPrice +
              (bestValueOfferPostagePrice / (bestValueOfferAmountOfCards+1)))
            {
              bestValueOffer = value[i];
              // bestValueOfferAmountOfCards = 1
              // bestValueOfferPostagePrice = postageVal;
            }
          }
        }
      }
      // console.log("BEST VALUE : "+ bestValueOffer.user +" at: £"+ bestValueOffer.price); 
      var userBuyList = buyListRefined.get(bestValueOffer.user);
      if (userBuyList !== undefined)
      {
        userBuyList.push({card: key, price: bestValueOffer.price});
      }
      else
      {
        userBuyList = [{card: key, price: bestValueOffer.price}];
      }
      priceOfBuylistRefined+=parseFloat(bestValueOffer.price);
      buyListRefined.set(bestValueOffer.user, userBuyList);
    }
  }
  var postageForBuylist = 0.00;
  var postageForBuylistRefined = 0.00;

  for(var entry of buyList.entries())
  {
    var key = entry[0];
    var value = entry[1];
    var totalPriceFromUser = 0;
    var postage = 1;
    for(var i = 0; i < value.length ; i++) 
    {
      if(value[i].price >= 20)
      {
        postage = 2.1;
        break;
      } 
      totalPriceFromUser += value[i].price;
      if (totalPriceFromUser >= 20)
      {
        postage = 2.1;
        break;
      }
    };
    postageForBuylist+=postage;
  }

  for(var entry of buyListRefined.entries())
  {
    var key = entry[0];
    var value = entry[1];
    var totalPriceFromUser = 0;
    var postage = 1;
    for(var i = 0; i < value.length ; i++) 
    {
      if(value[i].price >= 20)
      {
        postage = 2.1;
        break;
      } 
      totalPriceFromUser += value[i].price;
      if (totalPriceFromUser >= 20)
      {
        postage = 2.1;
        break;
      }
    };
    postageForBuylistRefined+=postage;
  }
  console.log("Cost of buylist: £"+(priceOfBuylist + postageForBuylist) +" for "+cardMap.size+" cards, from "+buyList.size+ " users.");
  console.log("Cost of buylist Refined: £"+(priceOfBuylistRefined + postageForBuylistRefined) +" for "+cardMap.size+" cards, from "+buyListRefined.size+ " users.");
  return ((priceOfBuylist + postageForBuylist) < (priceOfBuylistRefined + postageForBuylistRefined)) ? {buyList: buyList, price: (priceOfBuylist + postageForBuylist)} : {buyList: buyListRefined, price: (priceOfBuylistRefined + postageForBuylistRefined)};
}

//NEXT ALGORITHM
// Map users who sell the most cards. start with single buyers. then fewest avail cards ++
// Prioritise users who have more cards to lessen the buyers.
function cardsByFewerSellers(cardMap)
{
  var cardCount = cardMap.size;
  var buyList = new Map();
  // console.log("Card Count: "+cardCount);
  var i = 0 ;
  while (i < cardCount && cardMap.size !== 0)
  { 
    i++;
    // console.log(i);
    var userMapFirst = cardMapToUserMap(cardMap);
    // console.log(userMapFirst);
    //find user with most cards
    var mostCardsUser = userWithMostCardsInUserMap(userMapFirst);
    // console.log("MOST CARD USER:");
    // console.log(mostCardsUser);
    buyList.set(mostCardsUser.user, mostCardsUser.cardMap);
    //remove cards from card map
    mostCardsUser.cardMap.forEach(offer => {
      cardMap.delete(offer.card);
    });
  }
  // console.log(buyList);

  //work out price
  var allCardsCost = 0.00;
  for(var entry of buyList.entries())
  {
    var key = entry[0];
    var value = entry[1];
    var totalPrice = 0.00;
    console.log("\t"+key+" => ");
    for (let index = 0; index < value.length; index++) 
    {
      let userOffers = value[index];
      totalPrice += parseFloat(userOffers.price);
      console.log("\t\tcard: "+userOffers.card+" , price : "+userOffers.price);
    }
    var postageCost = (value.length > 20) ? 1.95 : 1;
    console.log("\t\t\tTotal price: "+(totalPrice+postageCost));
    allCardsCost+= totalPrice+postageCost;
  }

  console.log("Cost of fewest user buylist: £"+(allCardsCost) +" for "+cardCount+" cards, from "+buyList.size+ " users.");

}

function cardMapToUserMap(cardMap)
{
  var userMap = new Map();
  for(var entry of cardMap.entries())
  {
    var key = entry[0];
    var value = entry[1];
    for (var i = 0; i < value.length; i++)
    {
      if (userMap.get(value[i].user) !== undefined)
      {
        var userCardList = userMap.get(value[i].user);
        if (userCardList !== undefined)
        {
          var cardAlreadyInList = false;
          for(var j = 0; j < userCardList.length; j++)
          {
            if (userCardList[j].card === key)
            {  
              cardAlreadyInList = true;
              break;
            }
          }
          if (!cardAlreadyInList)
          {
            userCardList.push({card: key, price: value[i].price});
            userMap.set(value[i].user, userCardList);
          }
        }
      }
      else
      {
        userMap.set(value[i].user, [{card: key, price: value[i].price}]);
      }
    }
  }
  return userMap;
}

function userWithMostCardsInUserMap(userMap)
{
  var mostCardsUser = {user : "", cardMap: []};
  for (const entry of userMap.entries()) 
  {
    var key = entry[0];
    var value = entry[1];
    if (mostCardsUser.user === "")
    {
      mostCardsUser = {user: key, cardMap: value};
    }
    else
    {
      if (value.length > mostCardsUser.cardMap.length)
      {
        mostCardsUser = {user: key, cardMap: value}
      }
    }
  }
  return mostCardsUser;
}


function compareOffers(a, b)
{
  if ( a.price < b.price ){
    return -1;
  }
  if ( a.price > b.price ){
    return 1;
  }
  return 0;
}

async function getListByUser()
{
  var fileName = "./inputlist.txt";
  var retreivedCards = 0;
  var file = fs.readFileSync(fileName);
  var lines = file.toString().split('\n');
  var cardCount = lines.length;
  console.log("CardCount: "+cardCount);
  var cardMap = new Map(); 
  for(var i = 0; i < lines.length; i++) 
  {
    var formattedLine = lines[i].replace(/[\n\r]+/g, '');
    var overridden = (formattedLine.includes("/")) ? true : false;
    await delay(500);
    getOffers(formattedLine, overridden).then((cheapestArr) =>
    // getOffers(formattedLine, (cheapestArr) =>
    {
      retreivedCards++;
      cheapestArr.forEach(offer => 
        {
          if (cardMap.get(offer.itemOffered.name) !== undefined)
          {
            var cardList = cardMap.get(offer.itemOffered.name);
            cardList.push({user: offer.seller.name, price: offer.price});
            cardMap.set(offer.itemOffered.name, cardList);
          }
          else
          {
            cardMap.set(offer.itemOffered.name, [{user:offer.seller.name, price: offer.price}]);
          }
        });
        if (retreivedCards === cardCount)
        { 
          console.log("retreivedCards: "+ retreivedCards + " cardCount: "+ cardCount);
          console.log("starting optimisation of buylist");
          optimiseResults(cardMap);

        }
    })
    .catch((error) =>
    {
      console.log(error);
    });
  }
}


function getOffers(cardName, overridden)
{
  return new Promise((resolve, reject) =>
  {
    var formattedCardName = cardName.toLowerCase().replace(/ /g, "-").replace(/'|,|"/g, "");
    var options = {
      host: 'lilianamarket.co.uk',
      port: 443,
      path: (!overridden)? '/magic-cards/'+formattedCardName : '/magic-card/'+formattedCardName,
      headers: 
      {
          "Content-Type": "application/json"
      }
    };
    // console.log("Requesting: "+ formattedCardName);
    var req = https.get(options, function(res) {
      // Buffer the body entirely for processing as a whole.
      var bodyChunks = [];

      res.on('data', function(chunk) {
        // You can process streamed parts here...
        bodyChunks.push(chunk);
      }).on('end', function() {
        var body = Buffer.concat(bodyChunks);
        var bodyStr = body.toString();
        // console.log(bodyStr);
        var offers = "{"+bodyStr.substring(bodyStr.lastIndexOf("\"offers\": ["), bodyStr.lastIndexOf("]"))+"]}";
        
        try 
        {
          console.log("Found: "+formattedCardName);
          var jsonOffers = JSON.parse(offers);
          if (jsonOffers.offers.length === 0)
          {
            console.log("No offers found for: " + cardName);
            cardsNotAvailable.push(cardName);
          }
          var cheapest = new Array();
          jsonOffers.offers.forEach(offer => 
          {
            cheapest.push(offer);
          });
          resolve(cheapest);
        } 
        catch (error) 
        {
          console.log(error);
          console.log("ERROR could not find page for: "+cardName);
        }
        
      });
    });

    req.on('error', function(e) {
      reject(console.log('ERROR: ' + e.message));
    });
    req.end();
  });

}

  
  