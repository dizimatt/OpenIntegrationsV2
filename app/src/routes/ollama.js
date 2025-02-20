import { ChatOllama, Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import {  } from "@langchain/ollama";
import { TokenTextSplitter } from "langchain/text_splitter";

import axios from 'axios';

var ollama = new ChatOllama();
var webContent = "";

async function fetchWebHTML(url) {
  const { data } = await axios.get(url);
//  console.log("data (string): %s", JSON.stringify(data) );
  return data;
 // Adjust the selector as needed
}

export async function apiOllamaSendMessageWS(ws, msg_obj) {
  try{

    const loader = new CheerioWebBaseLoader("https://bushrangerhoney.com.au/products.json");

    const docs = await loader.load();

    const textSplitter = new TokenTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 20,
    });

    // Note that this method takes an array of docs
    const splitDocs = await textSplitter.splitDocuments(docs);

    const vectorstore = await MemoryVectorStore.fromDocuments(
      splitDocs.slice(0, 10),
      ollama
    );
    console.log("vectorstore: %o", vectorstore);
    
    // Only extract from top document
    const retriever = vectorstore.asRetriever({ k: 1 });

    console.log("retriever: %o", retriever);
  
  
    
    const query = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an expert extraction algorithm.
Only extract relevant information from the text.
If you do not know the value of an attribute asked to extract,
return null for the attribute's value.`,
      ],
      ["user", "contextual information for the query: {context}, question: {input}"],
    ]);
    const chain = prompt.pipe(ollama);
    const stream = await chain.stream({
      input: query,
      context: JSON.stringify(webContent),
    });
    

    /*
    const stream = await ollama.stream([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: query,
          },
          {
            type: "text",
            text: JSON.stringify(context_data),
          },
        ],
      }),
    ]);
    */
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

export async function initOllama() {
    console.log("initOllama");

    ollama = new ChatOllama({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b",
      streaming: true,
      options: {
        num_ctx: 100000
      }   
    });

    ollama = new OllamaEmbeddings({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b",
      streaming: true,
      options: {
        num_ctx: 100000
      }   
    });
    
    const url = 'https://bushrangerhoney.com.au/products.json';
    webContent = await fetchWebHTML(url);

    webContent.products.forEach(product => {
      product.price = product.variants[0].price;
      delete product.variants
      delete product.images;
    }, this);

//    console.log("webContent: %o", webContent);

    return ollama;
};

  
