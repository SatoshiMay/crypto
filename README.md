# Cryptocurrency
A cryptocurrency fullnode written in typescript

## Pre-requisites
1. Linux ubuntu 16.04 LTS (any Linux flavor should work)
2. "Node.js" : "^8.9.3"
3. "MongoDB": "^3.4.10"
Run mongod on localhost:27017.

## Installation
```
git clone --depth=1 https://github.com/SatoshiMay/cryptocurrency.git
npm install
```

## Example Usage
Below is an example sequence of steps to create an account and transfer currency to it. 

**Disclaimer: The below steps will create two databases - "dev_trinity" and "dev_trinity_2" in your local MongoDB installation. If this not acceptable, do not proceed.**

#### Transpile TS to JS
```
npm run build
````
#### Start 1<sup>st</sup> fullnode
```
npm run serve:dev
```
Listens for Http connections on port 3000 and WebSocket connections on port 8333. 

Creates "dev_trinity" database in MongoDB installation. 

#### Start 2<sup>nd</sup> fullnode
```
npm run serve:dev2
```
Listens for Http connections on port 3001 and WebSocket connections on port 8334. Also opens WebSocket connection to 1<sup>st</sup> fullnode. 

Creates "dev_trinity_2" database in MongoDB installation.


#### Get list of accounts on 1<sup>st</sup> fullnode wallet
```
curl localhost:3000/wallet/accounts
```
The "miner" account gets created by default upon starting a fullnode

#### Get "miner" account balance on 1<sup>st</sup> (and/or 2<sup>nd</sup>) fullnode
```
curl localhost:3000/wallet/accounts/miner/balance
and/or curl localhost:3001/wallet/accounts/miner/balance
```

#### Mine a block on 1<sup>st</sup> fullnode 
```
curl localhost:3000/mine
```
This adds 125000000 units as mining reward to miner balance.
The mined block gets propograted to all connected fullnodes.

#### Check "miner" balance on 1<sup>st</sup> fullnode
```
curl localhost:3000/wallet/accounts/miner/balance
```

#### Create a "dummyUser" account in 1<sup>st</sup> fullnode wallet
```
curl --header "Content-Type: application/json" \
  --request POST \
  --data '{"username":"dummyUser"}' \
  http://localhost:3000/wallet/accounts
```

#### Check "dummyUser" balance
```
curl localhost:3000/wallet/accounts/dummyUser/balance
```

#### Create transaction of 600000000 units from "miner" to "dummyUser"
```
curl --header "Content-Type: application/json" \
  --request POST \
  --data '{"from": "miner", "to": "dummyUser", "value": 600000000}' \
  http://localhost:3000/wallet/accounts/transaction
```
The transaction gets propogated to all connected fullnodes

#### Check pending transactions on 1<sup>st</sup> (and/or 2<sup>nd</sup>) fullnode
```
curl localhost:3000/mempool
and/or curl localhost:3001/mempool
```

#### Mine a block on 1<sup>st</sup> (or 2<sup>nd</sup>) fullnode to confirm pending transaction
```
curl localhost:3000/mine 
or curl localhost:3001/mine
```

The mined block gets propogated to all connected fullnodes 

#### Check "miner" balance on 1<sup>st</sup> (and/or 2<sup>nd</sup>) fullnode
```
curl localhost:3000/wallet/accounts/miner/balance
and/or curl localhost:3001/wallet/accounts/miner/balance
```

#### Check "dummyUser" balance
```
curl localhost:3000/wallet/accounts/dummyUser/balance
```

## Cleanup
Delete the databases "dev_trinity" and "dev_trinity_2" from MongoDB to start over from scratch.

