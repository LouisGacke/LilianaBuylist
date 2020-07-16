once cloned / downloaded
npm install

to run app ensure the inputList.txt file contains a line separated file containing the name of each card you wish to buy from liliana.

to run the application use node index.js in root folder.

once the app has found all the cards and evaluated different basket combinations, the output will contain a list of the cheapest cards and the user who sells it, a second list which is the cheapest list the application could compile, finally a list containing all the cards sold by the least amount of users.

Any cards not found on liliana will also be detailed.

If at any point during the lookup, the app fails, it is probably due to the card having a special name (maybe its a dual card). To fix this search of the card on liliana and copy the uri path after /magic-card/ for example for the card find // finality the value we need to put in the inputList.txt file for it is guilds-of-ravnica/find/vwilmq

