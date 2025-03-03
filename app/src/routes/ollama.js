import { ChatOllama, Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatMessagePromptTemplate, ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";

import { NomicEmbeddings } from "@langchain/nomic";
import { Document } from '@langchain/core/documents';

import { MemoryVectorStore } from "langchain/vectorstores/memory";
//import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import axios from 'axios';
import { readFileSync } from "fs";

// 1. Import document loaders for different file formats
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { JSONLoader } from "langchain/document_loaders/fs/json";

// 2. Import OpenAI langugage model and other related modules
import { OpenAI,OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { RetrievalQAChain, loadQARefineChain } from "langchain/chains";

import { Agent } from "praisonai";



var ollama = new Ollama();
var ragChain = null;
var retriever = null;

async function fetchWebHTML(url) {
  const { data } = await axios.get(url);
//  console.log("data (string): %s", JSON.stringify(data) );
  return data;
 // Adjust the selector as needed
}

export async function apiOllamaSendMessageWS(ws, msg_obj) {
  try{
  
    const query = msg_obj.question;
    ws.send("sending the query langchain/ollama, please wait\n");

    const retrievedDocs = await retriever.invoke("listed products?");
    const stream = await ragChain.stream({
      question: query,
      context: retrievedDocs,
    });

    for await (const chunk of stream){
      ws.send(chunk);
    }

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
    ollama = new Ollama({
      baseUrl: "http://ollama:11434", // Default value
      model: "deepseek-r1:1.5b",
      streaming: true,
      options: {
        num_ctx: 100000
      }   
    });    

    try{
      // langchain-local process
      
      var ollamaEmbed = new OllamaEmbeddings({
        baseUrl: "http://ollama:11434", // Default value
        model: "mxbai-embed-large:latest",
      });
  
      console.log("Loading docs...")

      const data = readFileSync('./products-single.json');
//      const data = readFileSync('./docs/products.json');
//      console.log("data: %o",JSON.parse(data));

      const docs = [new Document({pageContent: data, metadata: {}})];

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 10000,
        chunkOverlap: 200
      });
      const splits = await textSplitter.splitDocuments(docs);
//      console.log("splits: %o",splits);

      console.log("loading the memoryvector store with the documents");
      const vectorstore = await MemoryVectorStore.fromDocuments(
        splits,
        ollamaEmbed
      );
  
      console.log("fetching retriever");
      retriever = vectorstore.asRetriever();

  
      console.log("creating chatprompttemplate from message");
      const promptTemplate = ChatPromptTemplate.fromTemplate(
        `You are an assistant for question-answering tasks related to Bee Products. Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
        The context is JSON-formatted data, each product in the json structure contains variant informatio, which includes price, size and title

        Question: {question}
        Context: {context}`
      );

  
      console.log("creating combineDocsChain");
      console.log("prompt.inputVariables: %o", promptTemplate.inputVariables);

      ragChain = await createStuffDocumentsChain({
        llm: ollama,
        prompt: promptTemplate,
      });

      // from here on, queries are carried out by the ui 
  
      /*
      console.log("createing retrievalchain");
      retrievalChain = await createRetrievalChain({
        combineDocsChain,
        retriever,
      }); 
      */

      console.log("finished initialising the ollama models");

      // end of trying
          // end of langchain-local process

    } catch (err) {
      console.log("failed to invoke retriever: %o", err);
    }

    return ollama;
};

  
