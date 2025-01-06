import OpenAI from "openai";
import {MongoClient} from 'mongodb';

var openai = null;
var aiAssistantID = null;
var aiThreadID = null;
export {openai, aiAssistantID, aiThreadID};

export function initOpenAI() {
    const myOpenai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    return openai = myOpenai;
};

export async function apiOpenAISendMessage(req, res){
    console.log("apiOpenAISendMessage");
    /*
    res.json({
        message: {
            data: "this is a dummy message!"
        }
    });
    */

    try{
        console.log("req.body: %o",req.body);
        const question = req.body.question;
    
        const message = await openai.beta.threads.messages.create(
            aiThreadID,
            {
              role: "user",
              content: question 
            }
        );
    
        let run = await openai.beta.threads.runs.createAndPoll(
            aiThreadID,
          { 
            assistant_id: aiAssistantID,
            instructions: `Please address the user as Matt. The user has a premium account.`
          }
        );
    
        let message_content = "";
        if (run.status !== 'completed') {
          while (run.status !== 'completed') {
            run = await openai.beta.threads.runs.poll(run.id);  
          }
        }
        // thread should have completed by this stage
        const messages = await openai.beta.threads.messages.list(
          run.thread_id
        );
        for (const message of messages.data.reverse()) {
          message_content = message_content + `${message.role} > ${message.content[0].text.value}\n`;
        }
    
        res.json({
            content:{
                run_status:run.status,
                message_content:message_content
            }
        });
        return {
          content:{
            run_status:run.status,
            message_content:message_content
          }
        };
    } catch (err) {
        console.log("failed to call sendmessage!, %s, %s", err.code, err.param);
        res.json({
            failed_message: err
        });
        return "error in sending the message: " + err;
    };
//    res.sendStatus(202);
}

async function OpenAICreateMainThread(dbClient){
//    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
//    await client.connect();
//    const db = client.db('openintegrations');
    const db = dbClient.db('openintegrations');

    var myReturn = {}
    var threadsQuery = {}

    const aIThread = await db.collection('threads').findOne(threadsQuery);
    if (aIThread){
        aiThreadID = aIThread.id;
    } else {
        try{
            const myThread = await openai.beta.threads.create();
            aiThreadID = myThread.id;
            try{
                db.collection('threads').insertOne(myThread);
            } catch (err) {
                console.log("failed to insert aithread object into collection!, %o", err);
            }
            myReturn = myThread;
        } catch (err) {
            console.log("OpenAICreateMainThread: failed to create main thread!, %o", err);
        }
    }

    return myReturn;
}

async function OpenAIRemoveMainAssistant(dbClient){
//    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
//    await client.connect();
//    const db = client.db('openintegrations');
    const db = dbClient.db('openintegrations');

    const returnOBJ = {
        data: {
            assistant_id: null,
            thread_id: null,
            assistant_deleted: false,
            thread_deleted: false
        }
    };

    if (aiAssistantID != null){
        try{
            await openai.beta.assistants.del(aiAssistantID);
            await db.collection('assistants').deleteOne({id: aiAssistantID});
            returnOBJ.data.assistant_id = aiAssistantID;
            returnOBJ.data.assistants_deleted = true;
            aiAssistantID = null;
        } catch (err) {
            console.log("OpenAIRemoveAllAssistants: failed to delete main Assistant (id: %s) from mongodb!, %o", aiThreadID, err);
        }
    }
    if (aiThreadID != null){
        try{
            await db.collection('threads').deleteOne({id: aiThreadID});
            await openai.beta.threads.del(aiThreadID);
            returnOBJ.data.thread_id = aiThreadID;
            returnOBJ.data.thread_deleted = true;
            aiThreadID = null;
        } catch (err) {
            console.log("OpenAIRemoveAllAssistants: failed to delete main thread (id: %s)!, %o",aiThreadID, err);
        }
    }
    return returnOBJ;
}
export async function apiOpenAIRemoveMainAssistant(req, res, dbClient){
    try{
        const returnOBJ = await OpenAIRemoveMainAssistant(dbClient);
        res.json({
            returnOBJ
        });
        } catch (err) {
        console.log("failed to call OpenAIRemoveAllAssistants!, %o", err);
    };
    return true;
}
export async function createMainAssistant(dbClient){
//    const client = new MongoClient(process.env.MONGO_CLIENT_URL);
//    await client.connect();
//    const db = client.db('openintegrations');

    const db = dbClient.db('openintegrations');

    console.log("createMainAssistant: fetching/creating main assistant, will be used for future threads");
    var assistantsQuery = {}
    const aIAssistant = await db.collection('assistants').findOne(assistantsQuery);
    if (aIAssistant){
        aiAssistantID = aIAssistant.id;
    } else {
        try{
            //    console.log("vectorStoreId: %s", vectorStoreId);
            const name = "Information Assistant";
            const instructions = 
            "You are an information assistant. " +
            "attached Vector files contain json-formatted information about a product catalogue. " +
            "the ID of the product is found in the \"id\" keypair, " +
            "the name (or otherwise knows as the title) of the product is found in the \"title\" keypair, " +
            "the description of the product is found in the \"body_html\" keypair - in HTML format" +
            "the URL of the product can be constructed by concatenating \"https://openresourcing.myshopify.com/products/\" with the \"handle\" keypair, " +
            "the image of the product can be constructed by concatenating \"https://openresourcing.myshopify.com/products/\" with the \"handle\" keypair, " +
            "there may be multiple \"variants\" nodes per product, " +
            "the price/s of the product is found in the \"price\" keypair within of the \"variants\" node/s of the product," +
            "the sku/s of the product is found in the \"sku\" keypair within of the \"variants\" node/s of the product, " +
            "the weight of the product is found in the \"weight\" keypair within of the \"variants\" node/s of the product";
        
            const assistant = await openai.beta.assistants.create({
                name: name,
                instructions: instructions,
                tools: [{ type: "file_search" }] ,
                model: "gpt-4o-mini" /*,
                response_format: { 
                    "type": "json_object" 
                }*/
            });
            aiAssistantID = assistant.id;
            try{
                db.collection('assistants').insertOne(assistant);            
            } catch (err) {
                console.log("failed to insert assistant object into collection!, %o", err);                
            }
        } catch (err) {
            console.log("failed to execute createMainAssistant!, %o", err);
        };
    }

    const aIThreadObj = await OpenAICreateMainThread(dbClient);
return true;        

}

export async function apiOpenAISendMessageWS(ws, msg_obj) {
    try{
      const question = msg_obj.question;
  
      // We use the stream SDK helper to create a run with
      // streaming. The SDK provides helpful event listeners to handle 
      // the streamed response.
      const message = await openai.beta.threads.messages.create(
        aiThreadID,
        {
          role: "user",
          content: question
        }
      );
        
      let run = openai.beta.threads.runs.stream(aiThreadID, {
        assistant_id: aiAssistantID
      })
      .on('textCreated', (text) => {
        ws.send('\nassistant > ');
      })
      .on('textDelta', (textDelta, snapshot) => {
        ws.send(textDelta.value);
      })
      .on('toolCallCreated', (toolCall) => {
  //      console.log(`\nassistant > ${toolCall.type}\n\n`);
        ws.send(`\nassistant > ${toolCall.type}\n\n`);
      })
      .on('toolCallDelta', (toolCallDelta, snapshot) => {
        if (toolCallDelta.type === 'code_interpreter') {
          if (toolCallDelta.code_interpreter.input) {
  //          console.log(toolCallDelta.code_interpreter.input);
            ws.send(toolCallDelta.code_interpreter.input);
          }
          if (toolCallDelta.code_interpreter.outputs) {
            ws.send("output >:");
            toolCallDelta.code_interpreter.outputs.forEach(output => {
              if (output.type === "logs") {
                ws.send(`${output.logs}`);
              }
            });
          }
        }
        console.log(`toolCallDelta.type:${toolCallDelta.type}`);
      })
      .on('textDone', (content) => {
  //      console.log("<aitextdone />");
        ws.send("<aitextdone />");
      })
      .on('messageDone', async (event) => {
        /*
        if (event.content[0].type === "text") {
          const { text } = event.content[0];
          const { annotations } = text;
          const citations = [];
      
          let index = 0;
          for (let annotation of annotations) {
            text.value = text.value.replace(annotation.text, "[" + index + "]");
            const { file_citation } = annotation;
            if (file_citation) {
              const citedFile = await openai.files.retrieve(file_citation.file_id);
              citations.push("[" + index + "]" + citedFile.filename);
            }
            index++;
          }
      
          console.log(text.value);  
          console.log(citations.join("\n"));
        }
        */
      });
      return {
        content:{
          run_status:run.status,
          message_content:"currently streaming the results to the server logs"
        }
      };
    
  
    } catch (err) {
      console.log("failed to call sendMessageWS!, %o", err);
      return "error in sending the message: " + err;
    };
  
  
  }
  
