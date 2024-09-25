
export function apiTest(req, res) {
    console.log("called the apiTest external function");
    res.send({called: "apiTest"});
}
export async function apiProducts(req, res, dbClient) {
    const shopURL = req.query.shop;
//    console.log("headers: %o",req.headers);

    //  const client = new MongoClient(process.env.MONGO_CLIENT_URL);
      const products = [];
      try{
    //    await client.connect();
    
        const db = dbClient.db('openintegrations');
    
        var prodQuery = {}
        if(shopURL){
          prodQuery = {shopURL:shopURL};
        }
        const productsCursor = await db.collection('products').find(prodQuery);
        for await (const product of productsCursor){
            products.push(product);
        }
      } catch (err) {
        console.log("failed to collect all products from mongodb! err: %o",err);
      }
    //  res.setHeader('content-type', 'Application/Liquid');
    //  res.set('content-type','Application/Liquid');
      res.json({products});
    
};
export async function apiProduct(req, res, dbClient) {
    const shopURL = req.query.shop;
    const { productId } = req.params;

//    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
    try{
//      await client.connect();

      const db = dbClient.db('openintegrations');

      const product = await db.collection('products').findOne({id: parseInt(productId)}); //,shopURL:shopURL});
      if (product){
          res.json({product});
      } else {
          res.sendStatus(404);
      }
    } catch (err) {
      res.sendStatus(404);
      console.log("failed to fetch product from mongodb!");
    }
};  
export async function apiLogin(req, res, dbClient) {
  const shopURL = req.query.shop;
//  console.log("headers: %o",req.headers);
  res.json({
    login_success:true,
    token: "letmein",
    shop: "openresourcing.myshopify.com"
  });
};

