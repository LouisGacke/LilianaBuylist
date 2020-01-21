const http = require('http');
const https = require('https');
const delay = require('delay');
const fs = require('fs');

var cardsNotAvailable = [];
getListByUser();

//initially find select card if we have already bought from them and cost is < £0.9 diffence than cheapest.
//next try build a % into how many cards a user has on offer and use them if % meets threshold.
// create 30x shuffled arrays and try algorithm and pick best.
var optimiseResults = (cardMap) =>
{
  var currentBestBuyList;
  //console.log(cardMap);
  for(var i = 0; i < 100; i++)
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
  console.log(currentBestBuyList.buyList);
  console.log("Cost of buylist: £"+currentBestBuyList.price +" for "+cardMap.size+" cards, from "+currentBestBuyList.buyList.size+ " users.");
  console.log("Cards not available:");
  console.log(cardsNotAvailable);
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
    buyList.set(value[0].user, [{card: key, price: value[0].price}]);
    priceOfBuylist+=parseFloat(value[0].price);
  }

  var postageForBuylist = 0.00;
  for(var entry of buyList.entries())
  {
    var key = entry[0];
    var value = entry[1];
    var totalPriceFromUser = 0;
    var postage = 0.9;
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
      buyList.set(value[0].user, [{card: key, price: value[0].price}]);
      priceOfBuylist+=parseFloat(value[0].price);
    }
    else
    {
      var bestValueOffer = value[0];
      var bestValueOfferAmountOfCards = (buyList.get(value[0].user) === undefined)? 1 : buyList.get(value[0].user).length;
      var bestValueOfferPostagePrice = (value[0].price >= 20)? 2.1 : 0.9;
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
          var postageVal = 0.9;
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
            break;
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
  for(var entry of cardMap.entries())
  {
    var key = entry[0];
    //make sure the offers are in price order;
    var value = entry[1].sort(compareOffers);
    //Only 1 offer for a card
    if (value.length === 1)
    {
      //console.log("Must buy '" +key+ "' from "+value[0].user);
      buyListRefined.set(value[0].user, [{card: key, price: value[0].price}]);
      priceOfBuylistRefined+=parseFloat(value[0].price);
    }
    else
    {
      var bestValueOffer = value[0];
      var bestValueOfferAmountOfCards = (buyListRefined.get(value[0].user) === undefined)? 1 : buyListRefined.get(value[0].user).length;
      var bestValueOfferPostagePrice = (value[0].price >= 2.4)? 2.1 : 0.9;
      for (var i = 0; i < value.length; i++)
      {
        //if offer is from current seller
        if (buyListRefined.get(value[i].user) !== undefined)
        {
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
          if (currentPrice + (postageVal / buyListRefined.get(value[i].user).length) < bestPrice +
            (bestValueOfferPostagePrice / bestValueOfferAmountOfCards))
          {
            bestValueOffer = value[i];
            bestValueOfferAmountOfCards = buyListRefined.get(value[i].user).length+1
            bestValueOfferPostagePrice = postageVal;
            break;
          }
        }
        else
        {
          // if offer is from a seller we have chosen in a previous iteration
          if (buyList.get(value[i].user) !== undefined)
          {
            var postageVal = bestValueOfferPostagePrice;
            // if new potential sellers postage+cost is less than original best offer + cost
            var currentPrice = parseFloat(value[i].price);
            var bestPrice = parseFloat(bestValueOffer.price);
            if (currentPrice + (postageVal) < bestPrice +
              (bestValueOfferPostagePrice / bestValueOfferAmountOfCards))
            {
              bestValueOffer = value[i];
              bestValueOfferAmountOfCards = 1
              bestValueOfferPostagePrice = postageVal;
              break;
            }
          }
        }
      } 
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
    var postage = 0.9;
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
    var postage = 0.9;
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
  return (priceOfBuylist < priceOfBuylistRefined) ? {buyList: buyList, price: (priceOfBuylist + postageForBuylist)} : {buyList: buyListRefined, price: (priceOfBuylistRefined + postageForBuylistRefined)};
}

//NEXT ALGORITHM
// Map users who sell the most cards. start with single buyers. then fewest avail cards ++
// Prioritise users who have more cards to lessen the buyers.

// Basic algorithm to pick cheapest on each card and total price + shipping

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
  var i = 0;
  var file = fs.readFileSync(fileName);
  var lines = file.toString().split('\n');
  var cardCount = lines.length;
  console.log("CardCount: "+cardCount);
  var cardMap = new Map(); 
  for(var i = 0; i < lines.length; i++) 
  {
    var formattedLine = lines[i].replace(/[\n\r]+/g, '');
    await delay(500);
    getOffers(formattedLine).then((cheapestArr) =>
    // getOffers(formattedLine, (cheapestArr) =>
    {
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
        if (i === cardCount)
        { 
          console.log("starting optimisation of buylist");
          optimiseResults(cardMap);
        }
    })
    .catch((error) =>
    {
      console.log(error);
    });
  }

  // fs.readFileSync(fileName, async (err, data) =>
  // {
  //   if (!err)
  //   {
  //     var lines = data.toString().split('\n');
  //     var cardCount = lines.length;
  //     console.log("CardCount: "+cardCount);
  //     var cardMap = new Map(); 
  //     lines.forEach(async (line) => 
  //     {
  //       var formattedLine = line.replace(/[\n\r]+/g, '');
  //       await delay(1000);
  //       getOffers(formattedLine).then((cheapestArr) =>
  //       {
  //         cheapestArr.forEach(offer => 
  //           {
  //             if (cardMap.get(offer.itemOffered.name) !== undefined)
  //             {
  //               var cardList = cardMap.get(offer.itemOffered.name);
  //               cardList.push({user: offer.seller.name, price: offer.price});
  //               cardMap.set(offer.itemOffered.name, cardList);
  //             }
  //             else
  //             {
  //               cardMap.set(offer.itemOffered.name, [{user:offer.seller.name, price: offer.price}]);
  //             }
  //           });
  //           i++;
  //           if (i === cardCount)
  //           {
  //             optimiseResults(cardMap);
  //           }
  //       });
  //     });
      
  //     // getRequest(cardNames);
  //   }
  // });
}

// function mapByCard(responses)
// {
//   console.log("responses");
//   console.log(responses);
//   for(response in responses)
//   {
//     console.log(response);
//     break;
//   }
// }

// function getRequest(cardNames)
// {
//   var responses = [];
//   var completed_requests = 0; 
 
//   for(i in cardNames)
//   {
//     var formattedCardName = cardNames[i].toLowerCase().replace(/ /g, "-").replace(/'|,/g, "");
//     var options = {
//       host: 'lilianamarket.co.uk',
//       port: 443,
//       path: '/magic-cards/'+formattedCardName,
//       headers: 
//       {
//           "Content-Type": "application/json"
//       }
//     };
//     https.get(options, function(res) {
//       var bodyChunks = [];

//       res.on('data', function(chunk) {
//         // You can process streamed parts here...
//         bodyChunks.push(chunk);
//       }).on('end', function() {
//         var body = Buffer.concat(bodyChunks);
//         var bodyStr = body.toString();
//         // console.log(bodyStr);
//         var offers = "{"+bodyStr.substring(bodyStr.lastIndexOf("\"offers\": ["), bodyStr.lastIndexOf("]"))+"]}";
        
//         try 
//         {
//           var jsonOffers = JSON.parse(offers);
//           if (jsonOffers.offers.length === 0)
//           {
//             console.log("No offers found for: " + cardNames[i]);
//           }
//           var cheapest = new Array();
//           jsonOffers.offers.forEach(offer => 
//           {
//             cheapest.push(offer);
//           });
//           responses.push(cheapest);
//           completed_requests++;
//           console.log("completeRequests: "+completed_requests);
//           if (completed_requests === cardNames.length)
//           {
//             mapByCard(responses);
//           }
//         } 
//         catch (error) 
//         {
//           console.log(error);
//           console.log("ERROR could not find page for: "+cardNames[i]);
//         }
//       });
//     });
//   }
// }

// function getOffers(cardName, callback)
// {
//   var formattedCardName = cardName.toLowerCase().replace(/ /g, "-").replace(/'|,/g, "");
//   var options = {
//     host: 'lilianamarket.co.uk',
//     port: 443,
//     path: '/magic-cards/'+formattedCardName,
//     headers: 
//     {
//         "Content-Type": "application/json"
//     }
//   };
//   var req = https.get(options, function(res) {
//     var bodyChunks = [];

//     res.on('data', function(chunk) {
//       // You can process streamed parts here...
//       bodyChunks.push(chunk);
//     }).on('end', function() {
//       var body = Buffer.concat(bodyChunks);
//       var bodyStr = body.toString();
//       // console.log(bodyStr);
//       var offers = "{"+bodyStr.substring(bodyStr.lastIndexOf("\"offers\": ["), bodyStr.lastIndexOf("]"))+"]}";
      
//       try 
//       {
//         console.log("Found: "+formattedCardName);
//         var jsonOffers = JSON.parse(offers);
//         if (jsonOffers.offers.length === 0)
//         {
//           console.log("No offers found for: " + cardName);
//         }
//         var cheapest = new Array();
//         jsonOffers.offers.forEach(offer => 
//         {
//           cheapest.push(offer);
//         });
//         callback(cheapest);
//       } 
//       catch (error) 
//       {
//         console.log(error);
//         console.log("ERROR could not find page for: "+cardName);
//       }
//     });
    
//   });
//   req.on('error', function(e) {
//     reject(console.log('ERROR: ' + e.message));
//   });
//   req.end();
// }
function getOffers(cardName)
{
  return new Promise((resolve, reject) =>
  {
    var formattedCardName = cardName.toLowerCase().replace(/ /g, "-").replace(/'|,|"/g, "");
    var options = {
      host: 'lilianamarket.co.uk',
      port: 443,
      path: '/magic-cards/'+formattedCardName,
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

  
  