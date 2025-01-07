import axios, { all } from 'axios';

export async function bigcommerceAuth(req, res) { //}, _dbClient) {
    console.log("bigcommerceAuth: req query: %o, req body: %o", req.query, req.body);

    const account_uuid = req.query.account_uuid;
    const code = req.query.code;
    const context = req.query.context;
    const scope = req.query.scope;

    const oauth2_token_url = `https://login.bigcommerce.com/oauth2/token`;
    const oauth2_headers = {
      'Content-Type': 'application/json',
      'accept': 'application/json'
    };
    const oauth2_post_data = {
        client_id: "a8e12qjcdizv425rvffddslh3c4cnf6",
        client_secret: "a73218264f957614997a1f105e42cf8d3fb12ac7ba962016e9223c91c8bff8c9",
        code: code,
        context: context,
        scope: scope,
        grant_type: "authorization_code",
        redirect_uri: "https://b105-111-65-37-164.ngrok-free.app/bigcommerce/auth"
    };

    const response_data = {}
    try{
        const response = await axios.post(oauth2_token_url, oauth2_post_data, {headers:oauth2_headers});
        response_data.data = response.data;
    }catch(error){
      console.log("error: %o", error);
    }


    res.send({bc_auth_success: "success",
        query: req.query,
        body: req.body,
        response: response_data
    });

  
    return true;
}
export async function bigcommerceLoad(req, res) { //}, _dbClient) {
    res.send({bc_load_status: "success"});
}
export async function bigcommerceUninstall(req, res) { //}, _dbClient) {
    res.send({bc_uninstall_status: "success"});
}
export async function bigcommerceRemoveUser(req, res) { //}, _dbClient) {
    res.send({bc_removeuser_status: "success"});
}

//wip: 
const sample_response = 
{ "data": 
    { "access_token": "3jiqii2679emauq7ur01pzgzp48a8lb", 
        "scope": "store_v2_default store_v2_products_read_only", 
        "user": 
        { 
            "id": 1264190, 
            "username": "matt.dilley@openresourcing.com.au", 
            "email": "matt.dilley@openresourcing.com.au" 
        }, 
        "owner": { 
            "id": 1264190, 
            "username": "matt.dilley@openresourcing.com.au", 
            "email": "matt.dilley@openresourcing.com.au" 
        }, 
        "context": "stores/rpx9efkcf8", 
        "ajs_anonymous_id": null, 
        "account_uuid": "665e0970-bf98-475d-9d40-bafca85c5a03" 
    } 
}
