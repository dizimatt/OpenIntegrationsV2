import shopify, {shopifyApi, LATEST_API_VERSION, ApiVersion, DataType} from '@shopify/shopify-api';
import csvToJson from 'csvtojson';


var shopifyApiClient = shopifyApi;

var dbClient;

export async function shopifyAuthCallback(req, res, _dbClient) {
  const shopURL = req.query.shop;
  dbClient = _dbClient;
  await initShopifyApiClient(req.query.shop);

  try{
    const callback = await shopifyApiClient.auth.callback({
        rawRequest: req,
        rawResponse: res,
    });
 
    const db = dbClient.db('openintegrations');

    const shopifySessionDeleteCursor = await db.collection('shopifySession').deleteMany(
      {
        APP_NAME: process.env.APP_NAME,
        SHOPIFY_SESSION_SHOP: callback.session.shop
      }
    );

    const shopifySessionCursor = await db.collection('shopifySession').insertOne(
      {
        APP_NAME: process.env.APP_NAME,
        SHOPIFY_SESSION_ID: callback.session.id,
        SHOPIFY_SESSION_SHOP: callback.session.shop,
        SHOPIFY_SESSION_STATE: callback.session.state,
        SHOPIFY_ACCESS_TOKEN: callback.session.accessToken,
        SHOPIFY_SESSION_SCOPE: callback.session.scope
      }
    );
  } catch (err) {
  }  
  try{
  res.setHeader('Content-Type', 'text/html');
// old v1 logic...
    res.send( `<script lang="javascript">window.location.href = \"/\?shop=${shopURL}&host=${req.query.host}\";</script><h2>welcome to NOpenInt Custom Products</h2>This app should auto-redirect to the admin landing page, if it doesn't please <a href=\"/\?shop=${shopURL}">click here go to app home</a>` );
    //res.send( `<h2>welcome to NOpenInt Custom Products</h2>welcome to shop: ${shopURL}</h2>` );
  } catch (exc) {
    console.log("shopifyAuthCallback: problem sending res! exc: %o",exc.message);
  }


  // You can now use callback.session to make API requests

//    res.redirect('/my-apps-entry-page');
};

export async function shopifyAuth(req, res, _dbClient) {
    dbClient = _dbClient;

    await initShopifyApiClient(req.query.shop);
    // The library will automatically redirect the user
    try{
      const authresponse = await shopifyApiClient.auth.begin({
        shop: shopifyApiClient.utils.sanitizeShop(req.query.shop, true),
        callbackPath: '/auth/callback',
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });
    }catch(exc){
      console.log("failed to auth: %o", exc);
      res.send(202);
    }
};

const fetchShopifySession = async (shopURL) => {
    try{

        const db = dbClient.db('openintegrations');

        var param_SHOPIFY_SESSSION_SHOP = ""
        if (shopURL){
            param_SHOPIFY_SESSSION_SHOP = shopURL;
        }
        const ShopifySession = await db.collection('shopifySession').findOne({SHOPIFY_SESSION_SHOP: param_SHOPIFY_SESSSION_SHOP});

        if (ShopifySession){
            return {
            id: ShopifySession.SHOPIFY_SESSION_ID,
            shop: ShopifySession.SHOPIFY_SESSION_SHOP,
            state: ShopifySession.SHOPIFY_SESSION_STATE,
            isOnline: false,
            accessToken:  ShopifySession.SHOPIFY_ACCESS_TOKEN,
            scope: ShopifySession.SHOPIFY_SESSION_SCOPE
            };
        } else {
            return {};
        }
    } catch (err) {
    console.log("failed to query session from mongodb!");
    return {};
    }

};
    
const fetchShopifyAPICreds = async (shopURL) => {
//  const client = new MongoClient(process.env.MONGO_CLIENT_URL);
    try{
//    await client.connect();
    const db = dbClient.db('openintegrations');

    //first fetch the shopify app name from the session table/collection (if not found, it's not installed - take it from the env vars)
    const ShopifySession = await db.collection('shopifySession').findOne({SHOPIFY_SESSION_SHOP: shopURL});
    var app_name = "";
    if (ShopifySession){
        app_name = ShopifySession.APP_NAME;
    } else {
        app_name = process.env.APP_NAME;
    }
    const ShopifyApp = await db.collection('shopifyApp').findOne({APP_NAME: app_name});

    if (ShopifyApp){
        return {
        apiKey: ShopifyApp.SHOPIFY_API_KEY,
        apiSecretKey: ShopifyApp.SHOPIFY_API_SECRET_KEY,
        scopes: ShopifyApp.SHOPIFY_SCOPES.split(", "),
        hostName: ShopifyApp.SHOPIFY_HOSTNAME  
        };
    } else {
        return {};
    }
    } catch (err) {
    console.log("failed to query shop-session from mongodb! err: %o",err);
    return {};
    }
};
const initShopifyApiClient = async (shopURL) => {
    const _shopifyAPICreds = await fetchShopifyAPICreds(shopURL);
    try{
        shopifyApiClient = shopifyApi(_shopifyAPICreds);
    }catch(err){
        console.log(`errored in initialising the shopifyapi: ${err.message} `);
    };
    
    if (shopURL !== undefined){
        return await fetchShopifySession(shopURL);
    } else {
        return {};
    }
}
      
async function getShopifyProducts(req, _dbClient) {
    dbClient = _dbClient;
    const shopURL = req.query.shop;
    // get a all products via GET RESTful API call
    const shopify_session = await initShopifyApiClient(shopURL);
    const allProducts = {products:[]};
    var nextPage_query_page_info = "";
    do{
      try{
        const client = await new shopifyApiClient.clients.Rest({
          session: shopify_session,
          apiVersion: LATEST_API_VERSION,
        });
        const query = {
          limit: 100
        };
        if (nextPage_query_page_info){
          query.page_info = nextPage_query_page_info;
        }
        const products = await client.get({
          path: 'products.json',
          query: query
        });

        if (products !== undefined){
          allProducts.products.push(...products.body.products);
          if (products.pageInfo !== undefined && products.pageInfo.nextPage !== undefined){
            nextPage_query_page_info = products.pageInfo.nextPage.query.page_info;
          } else {
            nextPage_query_page_info = "";
          }
        } else {
          nextPage_query_page_info = "";
        }

      }catch(err){
        console.log(`shopify/products: error  in calling the shopify client api: ${err.message}`);        
        nextPage_query_page_info = "";
//        res.send({failed:true, error: err.message});
      }
    } while (nextPage_query_page_info);
    return allProducts;
}
export async function apiShopifyProducts(req, res, _dbClient) {
  dbClient = _dbClient;
  res.send(await getShopifyProducts(req,_dbClient));
}

export async function apiShopifyProductsIndex(req, res, _dbClient) {
    dbClient = _dbClient;
    const shopURL = req.query.shop;
    // get a all products via GET RESTful API call
  
    try{
  
      const productsResults = await getShopifyProducts(req, _dbClient);
  
      const finalProducts = [];
      if (productsResults.products){
      
        const db = dbClient.db('openintegrations');
  
        db.collection('products').deleteMany({shopURL: shopURL});
  
        //productsResults.body.products.
        productsResults.products.forEach(product => { 
          finalProducts.push(product);
  
          //now write the same product back to mogodb
          Object.assign(product, {shopURL: shopURL});
          const productsCursor = db.collection('products').insertOne(product)
          .catch((err) => {
            res.send({mongoerror: err});
          });
      
        });
      }
      res.send(finalProducts);
    } catch(err) {
      console.log(`error  in callingthe shopify client api: ${err.message}`);
      res.send({failed:true, error: err.message});
    }
}
export async function apiShopifyProductsImport(req, res, _dbClient) {
    dbClient = _dbClient;
    const shopURL = req.query.shop;
    // get a all products via GET RESTful API call
    const shopify_session = await initShopifyApiClient(shopURL);
    try{
      // get a single product via its product id
      const client = new shopifyApiClient.clients.Rest({
        session: shopify_session,
        apiVersion: LATEST_API_VERSION,
      });
      
      const body = req.body;
      
      if (req.rawBody !== undefined){
  
        const products = await csvToJson().fromString(req.rawBody);
  
        products.forEach( async product => {
  
          const productsResults = await client.post({
            path: `products`,
            data: {
              product: product
            },
            type: DataType.JSON
          }).catch((err) => {
            console.log("product insert failed:" + err.message + ": \nproduct payload:\n %o",product);
          });
  
          // insert was successful, now need to retreve the product id...
          if (productsResults !== undefined && product.category){
            const newProductId = productsResults.body.product.id;
            
            if (product.category){
              const collectionUpdateResults = await client.put({
                path: `custom_collections/${product.category}`,
                data: {
                  custom_collection:{
                    id: product.category,
                    collects: [
                      { 
                        product_id: newProductId,
                        position: 1
                      }
                    ]
                  }
                },
                type: DataType.JSON
              }).catch((err) => {
                console.log("collection update failed:" + err.message + ": \ncollection id: "+product.category+", product id: " +newProductId);
              });
            }
          }
  
        });
        res.send(products);
      } else {
        res.send({failed:true, error: "couldn't find the products to insert!"});
      }
    } catch(err) {
      console.log(`error  in calling the shopify client api: ${err.message}`);
      res.send({failed:true, error: err.message});
    }
};
export async function apiShopifyProduct(req, res, _dbClient) {
    dbClient = _dbClient;
    const shopURL = req.query.shop;
    // get a all products via GET RESTful API call
    const shopify_session = await initShopifyApiClient(shopURL);
  
    const { productId } = req.params;
  
        
        // get a single product via its product id
        try{
          const client = new shopifyApiClient.clients.Rest({
            session: shopify_session,
            apiVersion: LATEST_API_VERSION,
          });
          const product = await client.get({
            path: `products/${productId}.json`,
            query: {id:1, title: "title"}
          }).catch((err) => {
            const product = {};
          });
  
          const newProduct = {product:{}};
          if (product !== undefined){
            newProduct.product = product.body.product;
          }
      //      const product = await shopify.rest.Product.find({session, id: '7504536535062'});
    
          res.send(newProduct);
        }catch(err){
          console.log(`error  in callingthe shopify client api: ${err.message}`);
          res.send({failed:true, error: err.message});
        }
};

export async function apiShopifyGqlCartTransforms(req, res, _dbClient) {
  dbClient = _dbClient;
  const shopURL = req.query.shop;

  // get a all products via GET RESTful API call
  const shopify_session = await initShopifyApiClient(shopURL);

  try{
    const client = new shopifyApiClient.clients.Rest({
      session: shopify_session,
      apiVersion: LATEST_API_VERSION,
    });
    const products = await client.post({
      path: `graphql.json`,
      data: `query {
        cartTransforms {
        }
      }`
      ,
      type: DataType.GraphQL
    }).catch((err) => {
      console.log(`error  in calling the shopify client api: ${err.message}`);
      res.send({error: err.message})
    });

    if (products !== undefined){
      if (products.body.errors !== undefined){
        res.send({error: products.body.errors});
      } else {
        res.send({products: products.body.data.products});
      }
    }
  }catch(err){
    console.log(`error  in calling the shopify client api: ${err.message}`);
    res.send({error: err.message});
  }

}


async function getGqlProducts(req, _dbClient) {
    dbClient = _dbClient;
  const shopURL = req.query.shop;

  // get a all products via GET RESTful API call
  const shopify_session = await initShopifyApiClient(shopURL);
  const all_products = {products:[]};
  var cursor = "";

  do {
    try{
      const client = new shopifyApiClient.clients.Rest({
        session: shopify_session,
        apiVersion: LATEST_API_VERSION,
      });
      const afterQuery = (cursor?`after: "${cursor}"`:'');
      const products = await client.post({
        path: `graphql.json`,
        data: `query {
            products(first: 100 ${afterQuery}) {
              edges {
                node {
                  id
                  title
                  handle
                }
                cursor
              }
            }
          }`
        ,
        type: DataType.GraphQL
      });

      if (products !== undefined){
        if (products.body.errors !== undefined){
          console.log('errors: %o', products.body.errors);
          cursor = "";
        } else {
          if (products.body.data.products.edges.length != 0){
            all_products.products.push(...products.body.data.products.edges);
            cursor = products.body.data.products.edges.slice(-1)[0].cursor;
          } else {
            cursor = "";
          }
        }
      } else {
        cursor = "";
      }
    }catch(err){
      console.log(`error (2) in calling the shopify client api: ${err.message}`);
        cursor = "";
    }
  } while (cursor)
  return all_products;
}
export async function apiShopifyGqlProducts(req, res, _dbClient) {
  res.send(await getGqlProducts(req,_dbClient));
}

export async function apiShopifyGqlBatchDelete(req, res, _dbClient) {
  const shopURL = req.query.shop;
  dbClient = _dbClient;
  const shopify_session = await initShopifyApiClient(shopURL);

  const response = {response:null};
    try{

      const client = new shopifyApiClient.clients.Rest({
        session: shopify_session,
        apiVersion: LATEST_API_VERSION,
      });
  
      const db = dbClient.db('openintegrations');
  
      var prodQuery = {};
      if(shopURL){
        prodQuery = {shopURL:shopURL};
      }
      const productsCursor = await db.collection('products').find(prodQuery,{
        projection: {
          id:1, title:1
        }
      });

      response.response = productsCursor;
      const allProducts = [];
      for await (const product of productsCursor){
          allProducts.push(product);
          const GQLResponse = await client.post({
            path: `graphql.json`,
            data: `mutation {
              productDelete(input: {id: "gid://shopify/Product/${product.id}"}) {
                deletedProductId
              }
            }`
            ,
            type: DataType.GraphQL
          });
          console.log("gqlresponse: %o",GQLResponse);
      }
      response.response = allProducts;
    } catch (err) {
      console.log("failed to collect all products from mongodb! err: %o",err);
      response.response = `failed - message: ${err.message}`;
    }

  // first get 
  res.send(response);


}


export async function apiShopifyWebhooks(req, res, _dbClient) {
  dbClient = _dbClient;
  const shopURL = req.query.shop;
  const webhook_id = req.query.id;
  // get a all products via GET RESTful API call
  const shopify_session = await initShopifyApiClient(shopURL);

  // Session is built by the OAuth process
  const client = new shopifyApiClient.clients.Rest({
    session: shopify_session,
    apiVersion: LATEST_API_VERSION,
  });
  const webhookList = await client.get({
    path: `webhooks`,
    type: DataType.JSON
  }).catch((err) => {
    console.log("webhook list failed: %o" + err.message);
  });

  res.send({webhooks:webhookList});

};
export async function apiShopifyWebhookUnsubscribe(req, res, _dbClient) {
  dbClient = _dbClient;
  const shopURL = req.query.shop;
  const webhook_id = req.query.id;
  // get a all products via GET RESTful API call
  const shopify_session = await initShopifyApiClient(shopURL);

  // Session is built by the OAuth process
  const client = new shopifyApiClient.clients.Rest({
    session: shopify_session,
    apiVersion: LATEST_API_VERSION,
  });
  const unsubscribeResults = await client.delete({
    path: `webhooks/${webhook_id}`,
    type: DataType.JSON
  }).catch((err) => {
    console.log("webhook unsubscribe failed: %o" + err.message);
  });

  res.send({webhook_unsubscribe_results:unsubscribeResults});
};
export async function apiShopifyWebhookSubscribeProductsUpdate(req, res, _dbClient) {
  dbClient = _dbClient;
  const shopURL = req.query.shop;
  // get a all products via GET RESTful API call
  const shopify_session = await initShopifyApiClient(shopURL);

  // Session is built by the OAuth process
  const client = new shopifyApiClient.clients.Rest({
    session: shopify_session,
    apiVersion: LATEST_API_VERSION,
  });


  const productsResults = await client.post({
    path: `webhooks`,
    data: {
      "webhook":{
        "address":`https://${shopifyApiClient.config.hostName}/api/shopify/webhook-triggers/products/update`,
        "topic":"products/update",
        "format":"json"
      }
    },
    type: DataType.JSON
  }).catch((err) => {
    console.log("webhook subscribe failed: %o" + err.message);
  });

  res.send({webhook_subscribe_results:productsResults});

};
export async function apiShopifyWebhookTriggersProductsUpdate(req, res, _dbClient) {
  dbClient = _dbClient;
  const body = req.body;

  res.send({
    status:"product updated!",
    request: req.body
  });
}

export async function apiShopifyWebhookSubscribeCartsUpdate(req, res, _dbClient) {
  dbClient = _dbClient;
  const shopURL = req.query.shop;
  // get a all products via GET RESTful API call
  const shopify_session = await initShopifyApiClient(shopURL);

  // Session is built by the OAuth process
  const client = new shopifyApiClient.clients.Rest({
    session: shopify_session,
    apiVersion: LATEST_API_VERSION,
  });


  const productsResults = await client.post({
    path: `webhooks`,
    data: {
      "webhook":{
        "address":`https://${shopifyApiClient.config.hostName}/api/shopify/webhook-triggers/carts/update?shop=${shopURL}`,
        "topic":"carts/update",
        "format":"json"
      }
    },
    type: DataType.JSON
  }).catch((err) => {
    console.log("webhook subscribe failed: %o" + err.message);
  });

  res.send({webhook_subscribe_results:productsResults});

};
export async function apiShopifyWebhookTriggersCartsUpdate(req, res, _dbClient) {
  dbClient = _dbClient;
  const body = req.body;
  const shopURL = req.query.shop;

  res.send({
    status:"cart updated!",
    request: req.body
  });
}
export async function apiShopifyWebhookSubscribeOrdersCreate(req, res, _dbClient) {
  dbClient = _dbClient;
  const shopURL = req.query.shop;

  try{
    if (shopURL) {
      // get a all products via GET RESTful API call
      const shopify_session = await initShopifyApiClient(shopURL);

      // Session is built by the OAuth process
      const client = new shopifyApiClient.clients.Rest({
        session: shopify_session,
        apiVersion: LATEST_API_VERSION,
      });


      const productsResults = await client.post({
        path: `webhooks`,
        data: {
          "webhook":{
            "address":`https://${shopifyApiClient.config.hostName}/api/shopify/webhook-triggers/orders/create?shop=${shopURL}`,
            "topic":"orders/create",
            "format":"json"
          }
        },
        type: DataType.JSON
      }); 
      res.setHeader('Content-Type', 'text/html');
      res.send(`<h2>Order Creation trigger created, please take note of id:${productsResults.body.webhook.id} for future reference</h2>`);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.send("<h2>shop url not provided</h2>");
    }
  } catch (exc){
    console.log("webhook subscribe failed: %o" + exc.message);
    res.setHeader('Content-Type', 'text/html');
    res.send(`<h2>webhook subscribe failed: ${exc.message}</h2>`);
  }

};
async function updateOrderWithEdocSessionID(shopURL, orderID, edocSessionIDs){
  try{
    if (shopURL) {
      // get a all products via GET RESTful API call
      const shopify_session = await initShopifyApiClient(shopURL);

      // Session is built by the OAuth process
      const client = new shopifyApiClient.clients.Rest({
        session: shopify_session,
        apiVersion: LATEST_API_VERSION,
      });

      const payload = {
        "order":{
          "id": parseInt(orderID),
          "note": `edocSessionoIds\n ${edocSessionIDs}`
        }
      };
      const productsResults = await client.put({
        path: `orders/${orderID}`,
        data: payload,
        type: DataType.JSON
      }); 
    } else {
      console.log("updateOrderWithEdocSessionID: shop url not passed in");
      return {};
    }
  } catch (exc) {
    console.log("error in updateOrderWithEdocSessionID: %s", exc.message);
    return {};
  }
};
export async function apiShopifyWebhookTriggersOrdersCreate(req, res, _dbClient) {
  dbClient = _dbClient;

  const body = req.body;
  const shopURL = req.query.shop;

  const edocSessionIDs = [];
  try{
    const custId = String(body.customer.id);
    for (const line_item of body.line_items){
      const prodId = String(line_item.product_id)

      //adding edoc values to this response (if they exist)
      const db = dbClient.db('openintegrations');
      const eDocCustomerSessionQuery = {
        shop_url: shopURL,
        shopify_cust_id: custId,
        shopify_prod_id: prodId
      };
      const eDocCustomerSessionEntry = await db.collection('eDocCustomerSession').findOne(eDocCustomerSessionQuery);
      if (eDocCustomerSessionEntry){
        const edoc_session_id = eDocCustomerSessionEntry.edoc_session_id;
        edocSessionIDs.push({
          prodId: prodId,
          edocSessionId: edoc_session_id
        });
      } else {
        //nothing to do here - just keeping here for debugging purposes
      }
    };
    if (edocSessionIDs.length){
      await updateOrderWithEdocSessionID( shopURL, body.id, JSON.stringify(edocSessionIDs));
    }

    res.send({
      status:"order created!",
      request: body
    });
  } catch (exc) {
    console.log("error in processing the order: %o", exc.message);
  }
};

export async function apiShopifyMandatoryCustomersDataRequest(req, res, _dbClient) {
  dbClient = _dbClient;
  console.log("apiShopifyMandatoryCustomersDataRequest: req body: %o",req.body);
  res.send(202);
};
export async function apiShopifyMandatoryCustomersRedact(req, res, _dbClient) {
  dbClient = _dbClient;
  console.log("apiShopifyMandatoryCustomersRedact: req body: %o",req.body);
  res.send(202);
};
export async function apiShopifyMandatoryShopRedact(req, res, _dbClient) {
  dbClient = _dbClient;
  console.log("apiShopifyMandatoryShopRedact: req body: %o",req.body);
  res.send(202);
};
