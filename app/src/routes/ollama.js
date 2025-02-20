import { ChatOllama, Ollama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as cheerio from 'cheerio';
import axios from 'axios';

var ollama = new ChatOllama();

async function fetchWebContent(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  return $('body').text(); // Adjust the selector as needed
}
async function fetchWebHTML(url) {
  const { data } = await axios.get(url);
//  console.log("data (string): %s", JSON.stringify(data) );
  return JSON.stringify(data.products);
 // Adjust the selector as needed
}

export async function apiOllamaSendMessageWS(ws, msg_obj) {

  const url = 'https://bushrangerhoney.com.au/products.json';
  const webContent = await fetchWebHTML(url);
  
  try{
    const query = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    //original directions...
    const context = {
      products: [
        {title: "test title", description: "test description", price: 2.01},
        {title: "test title 2", description: "test description 2", price: 3.01}
      ]
    };
    const stream = await ollama.stream([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: query,
          },
          {
            type: "text",
            text: JSON.stringify(context),
          },
        ],
      }),
    ]);

    for await (const chunk of stream){
      ws.send(chunk.content);
    }
    // end of original directions...

    ws.send("\nfinished the response\n");
    ws.send("<aitextdone />");
    console.log("sent the aitextdone tag to the client");

    return {
      content:{
        run_status:"executed",
        message_content:"check logs"
      }
    };
  } catch (err) {
    ws.send("failed to communicate with longchain/ollama, please contact the administrator for logs");
    ws.send("<aitextdone />");

    console.log("failed to invoke chain: %o", err);
    return {
      content:{
        run_status:"failed",
        message_content:err
      }
    };  

  } 
}

export async function apiOllamaTest(req, res) {
  console.log("making first query to ollama - deepseek");

  try{
    const outputParser = new StringOutputParser();

    var prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a world class technical documentation writer."],
      ["user", "what is LangSmith?"],
    ]);

    var chain = prompt.pipe(chatModel).pipe(outputParser);
    console.log("created chain from prompt template...");

    var response = await chain.invoke({input:"what is LangSmith?"});
    console.log("ollama response: %o", response);

    res.json({
      response
    });
    return;
  } catch (err) {
    console.log("failed to invoke chain: %o", err);
    const errMsg = err.message
    res.json({
      err:errMsg
    });
    return;
  }
}
export function initOllama() {
    console.log("initOllama");

    ollama = new ChatOllama({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b",
      streaming: true,
      options: {
        num_ctx: 100000
      }   
    });
    
    return ollama;
};

  
