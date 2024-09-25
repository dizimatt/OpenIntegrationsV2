import '@shopify/shopify-api/adapters/node';
import express, { json, query } from 'express';
import {MongoClient} from 'mongodb';
import {HMAC, AuthError} from "hmac-auth-express";
import dotenv from 'dotenv';
import {apiProducts,apiProduct, apiLogin} from './routes/main.js';
import {apiShopifyProducts, apiShopifyProductsIndex, apiShopifyProductsImport, apiShopifyProduct,  
  shopifyAuth,shopifyAuthCallback, 
  apiShopifyWebhookUnsubscribe, apiShopifyWebhooks, apiShopifyWebhookTriggersProductsUpdate, apiShopifyWebhookSubscribeProductsUpdate,
  apiShopifyWebhookSubscribeCartsUpdate, apiShopifyWebhookTriggersCartsUpdate,apiShopifyWebhookSubscribeOrdersCreate, apiShopifyWebhookTriggersOrdersCreate,
  apiShopifyGqlProducts, apiShopifyGqlCartTransforms,
  apiShopifyGqlBatchDelete,
  apiShopifyMandatoryCustomersDataRequest, apiShopifyMandatoryShopRedact, apiShopifyMandatoryCustomersRedact} 
  from './routes/shopify.js';
import {lazadaAuthCallback,apiLazadaProducts} from './routes/lazada.js';
import {tiktokAuthCallback,apiTiktokProducts} from './routes/tiktok.js';

import { createApp } from '@shopify/app-bridge';
import { ResourcePicker }  from '@shopify/app-bridge/actions/index.js';

import { createHmac } from 'crypto';
import fs from 'fs';
import https from 'https';
import bodyParser from 'body-parser';
const app_version = "1.1.2";

//import { generate} from "hmac-auth-express";

dotenv.config();
const dbClient = new MongoClient(process.env.MONGO_CLIENT_URL);

async function connectDB(){
  try{
    await dbClient.connect();
  } catch (err) {
    console.log("failed to connect to mongodb!, %o", err);
  }    
};


const app = express();
app.set('view engine', 'pug');

//app.use(bodyParser.urlencoded({ extended: false })); 
//app.use(bodyParser.json());


function rawBody(req, res, next) {
  if (req.is('text/*') == "text/plain"){
    req.setEncoding('utf8');
    req.rawBody = '';
    req.on('data', function(chunk) {
      req.rawBody += chunk;
    });
    req.on('end', function(){
      next();
    });
  } else {
    next();
  }
}
app.use(rawBody);

  //app.use(express.bodyParser());
//  app.use(express.methodOverride());


app.use(express.json());
app.use((req, res, next) => {
  if (req.query.shop){
//    console.log(`[middleware]: passed in shopurl: ${req.query.shop}`);
  }
  next();
});

app.use('/', (req, res, next) => {
  const config = {
    // The client ID provided for your application in the Partner Dashboard.
    apiKey: "5d9fed8825579b4e1633694ee110ceaa",
    // The host of the specific shop that's embedding your app. This value is provided by Shopify as a URL query parameter that's appended to your application URL when your app is loaded inside the Shopify admin.
    host: req.query.shop,
    forceRedirect: true
  };
  const shopifyapp = createApp(config);
  next();
});

app.use("/api",(req, res, next) => {
  if (req.query.shop){
    connectDB();
  }
  next();
});


// this is the hmac auth code - de-activate this when necessary
// moved this path onto /api/sec, because some api calls (ie. dashboard ones) do not require hmac auth
// totally enforcing HTTP 401 api rules for ALL shopify mandatory endpoints
// shopify have very strict requirements for this, and will refuse release of any apps that don't adhere to these rules

app.use("/api/shopify/mandatory",(req, res, next) => {
  const time = req.query.timestamp;
  var path = "";
  const _hmacFromQuery = (req.query.hmac?req.query.hmac:req.query.signature);

  const queryProperties = [];
  for (const queryKey of Object.keys(req.query)){
    if (queryKey !== "signature" && queryKey !== "hmac" ){
      queryProperties.push(`${queryKey}=${req.query[queryKey]}`);
    }
  }
  queryProperties.sort();
  path=queryProperties.join("");

  // this is a fixed secret (same app secret shared amongst other stores) - so it's safe to place here
  const hmac = createHmac('sha256', process.env.SHOPIFY_APP_SECRET || 'a4f0fa2eaab7c9676b95e2b35eab4d97');
  hmac.update(path);
  const digest = hmac.digest().toString('hex');

//  const digest = generate("a4f0fa2eaab7c9676b95e2b35eab4d97", "sha256", '', "GET", path, {}).digest("hex");
  if (digest !== _hmacFromQuery){ //req.query.signature){
    console.log("hmac failed! query: %o", req.query);
    res.send(401);
  } else {
    next();
  }
});
// keeping the internal api rules flexible while in dev mode - will tighten this to HTTP 401 once released
app.use("/api/sec",(req, res, next) => {
  const time = req.query.timestamp;
  var path = "";
  const _hmacFromQuery = (req.query.hmac?req.query.hmac:req.query.signature);

  const queryProperties = [];
  for (const queryKey of Object.keys(req.query)){
    if (queryKey !== "signature" && queryKey !== "hmac" ){
      queryProperties.push(`${queryKey}=${req.query[queryKey]}`);
    }
  }
  queryProperties.sort();
  path=queryProperties.join("");


  // this is a fixed secret (same app secret shared amongst other stores) - so it's safe to place here
  const hmac = createHmac('sha256','a4f0fa2eaab7c9676b95e2b35eab4d97');
  hmac.update(path);
  const digest = hmac.digest().toString('hex');

//  const digest = generate("a4f0fa2eaab7c9676b95e2b35eab4d97", "sha256", '', "GET", path, {}).digest("hex");
  if (digest !== _hmacFromQuery){ //req.query.signature){
    console.log("query: %o", req.query);
    next();
  } else {
    next();
  }
});


// express' error handler

 app.use( async (error, req, res, next) => {
    // check by error instance
//    next();
    if (error instanceof AuthError) {
      console.log("Autherror request - error.code: %o",error.code);
      console.log("error.message: %o",error.message);
      console.log("req.query: %o", req.query);
      console.log("req.headers: %o", req.headers);
      next();
    } else {
      console.log("Invalid request - error.code: %o",error.code);
      console.log("error.message: %o",error.message);
      console.log("req.query: %o", req.query);
      console.log("req.headers: %o", req.headers);
      next();
    }
  });

app.get('/api/shopify/gql/batch/delete', (req, res) => {
  apiShopifyGqlBatchDelete(req, res, dbClient);
});

app.get('/pug', (req, res) => {
  res.render('pugindex', { title: 'Hey', message: 'Hello there!' })
})

app.get('/',(req, res) => {
  const shopURL = req.query.shop;
  res.render('index', { 
    title: 'Open Integrations App', 
    shopurl: shopURL
  })
});

app.get('/api',(req, res) => {
    res.send(`<html><body><h1>you\'ve reached the api endpoints (v${app_version}) - please contact support for api documentation</h1></body></html>`);
});
// next two functions are the shopify app installation functions - add these endpoints into the shopify app config BEFORE installing
app.get('/auth', async (req, res) => {
  shopifyAuth(req,res,dbClient);
});

app.get('/auth/callback', async (req, res) => {
  shopifyAuthCallback(req,res,dbClient);
});
// end of shopify installations functions

app.get('/lazada/auth/callback', async (req, res) => {
  lazadaAuthCallback(req,res,dbClient);
});

app.get('/tiktok/auth/callback', async (req, res) => {
  tiktokAuthCallback(req,res,dbClient);
});

app.get('/api/products', async (req, res) => {
  apiProducts(req,res,dbClient);
});

app.get('/api/product/:productId', async (req, res) => {
  apiProduct(req,res,dbClient);
});

app.get('/api/shopify/product/:productId', async (req, res) => {
  apiShopifyProduct(req, res, dbClient);
});

app.get('/api/shopify/gql/products', async (req, res) => {
  apiShopifyGqlProducts(req, res, dbClient);
});
app.get('/api/shopify/gql/carttransforms', async (req, res) => {
  apiShopifyGqlCartTransforms(req, res, dbClient);
});

app.get('/api/shopify/products', async (req, res) => {
//  res.send()
    apiShopifyProducts(req,res,dbClient);
});

app.get('/api/shopify/products/index', async (req, res) => {
  apiShopifyProductsIndex(req,res,dbClient);
});

app.post('/api/shopify/products/import', async (req, res) => {
  apiShopifyProductsImport(req,res,dbClient);
});

app.get('/api/shopify/webhook/subscribe/products/update', async (req, res) => {
  apiShopifyWebhookSubscribeProductsUpdate(req,res,dbClient);
//  1150082351288
});
app.post('/api/shopify/webhook-triggers/products/update', async (req, res) => {
  apiShopifyWebhookTriggersProductsUpdate(req, res,dbClient);
});
app.get('/api/shopify/webhook/subscribe/carts/update', async (req, res) => {
  apiShopifyWebhookSubscribeCartsUpdate(req,res,dbClient);
//  1150082351288
});
app.post('/api/shopify/webhook-triggers/carts/update', async (req, res) => {
  apiShopifyWebhookTriggersCartsUpdate(req, res,dbClient);
});

app.get('/api/shopify/webhook/unsubscribe', async (req, res) => {
  apiShopifyWebhookUnsubscribe(req,res,dbClient);
  /*
  // 1150082220216
  */
});
app.get('/api/shopify/webhooks', async (req, res) => {
  apiShopifyWebhooks(req,res,dbClient);
  // 1150082220216
});

app.get('/api/shopify/webhook/subscribe/orders/create', async (req, res) => {
  apiShopifyWebhookSubscribeOrdersCreate(req,res,dbClient);
});
app.post('/api/shopify/webhook-triggers/orders/create', async (req, res) => {
  apiShopifyWebhookTriggersOrdersCreate(req,res,dbClient);
});

app.get('/api/tiktok/products', async (req, res) => {
  apiTiktokProducts(req, res, dbClient);
});

app.get('/api/lazada/products', async (req, res) => {
  apiLazadaProducts(req, res, dbClient);
});

app.use('/api/login', async (req, res) => {
  apiLogin(req, res, dbClient);
});

app.use('/api/shopify/mandatory/customers/data_request', async (req, res) => {
  apiShopifyMandatoryCustomersDataRequest(req, res, dbClient);
})
app.use('/api/shopify/mandatory/customers/redact', async (req, res) => {
  apiShopifyMandatoryCustomersRedact(req, res, dbClient);
})
app.use('/api/shopify/mandatory/shop/redact', async (req, res) => {
  apiShopifyMandatoryShopRedact(req, res, dbClient);
})

app.listen(8000, () => {
    console.log('Server is listening on port 8000');
});

// Creating object of key and certificate 
// for SSL 
/*
const options = { 
  key: fs.readFileSync("server.key"), 
  cert: fs.readFileSync("server.cert"), 
};
  
// Creating https server by passing 
// options and app object 
https.createServer(options, app) 
.listen(443, function (req, res) { 
  console.log("https Server started at port 443"); 
});
*/