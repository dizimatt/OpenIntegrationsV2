import { ChatOllama, Ollama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import * as cheerio from 'cheerio';
import axios from 'axios';

var ollama =  null;

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
  const myEscapedJSONString = webContent.replace(/"/g, '\\"');
  
  try{
    const question = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    const stream = await ollama.stream(
      [
        ["human", `based on the following JSON content ${webContent} :  \n. \nquery to answer: "${question}"`]
      ]
    );

    for await (const chunk of stream){
//      console.log("chunk: %o", chunk);
      ws.send(chunk.content);
    }
    
    ws.send("finished the response\n");
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

    ollama = new Ollama({
      baseUrl: "http://ollama:11434",
      model: "deepseek-r1:1.5b",
      streaming: true
    });

    var chatModel = new ChatOllama({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b",
      streaming: true
    });
    
    ollama = chatModel;
    return ollama;
};

  
