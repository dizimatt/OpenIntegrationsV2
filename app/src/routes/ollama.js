import { ChatOllama, Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatMessagePromptTemplate, ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { NomicEmbeddings } from "@langchain/nomic";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
//import { TextLoader } from "langchain/document_loaders/fs/text";
//import { RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import axios from 'axios';

// 1. Import document loaders for different file formats
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { JSONLoader } from "langchain/document_loaders/fs/json";

// 2. Import OpenAI langugage model and other related modules
import { OpenAI,OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { RetrievalQAChain, loadQARefineChain } from "langchain/chains";

import { Agent } from "praisonai";



var ollama = new Ollama();
var retrievalChain = null;
var docs = null;
var webContent = "";

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

    console.log("invoking the query on the chain");
    var stream = await retrievalChain.stream({
      input:query,
      context:""
    });
    for await (const chunk of stream){
      console.log(chunk);
      if (chunk.answer) {
        ws.send(chunk.answer);
      }
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

function loader() {
  return new DirectoryLoader("./docs", {
    ".json": (path) => new JSONLoader(path),
    ".txt": (path) => new TextLoader(path)
  });
}
function normalizeDocuments(docs) {
  return docs.map((doc) => {
    if (typeof doc.pageContent === "string") {
      return doc.pageContent;
    } else if (Array.isArray(doc.pageContent)) {
      return doc.pageContent.join("\n");
    }
  });
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
      docs = await loader().load();
//      console.log("docs: %o",docs);
  
      /*
      const chain = new RetrievalQAChain({
        combineDocumentsChain: loadQARefineChain(ollama),
        retriever: vectorStore.asRetriever(),
      });
      */
      console.log("loading the memoryvector store with the documents");
      const vectorstore = await MemoryVectorStore.fromDocuments(
        docs,
        ollamaEmbed
      );
  
      // start of trying...
      console.log("creating message for template");
  //    const message = ChatMessagePromptTemplate.fromTemplate("Answer the user's question: {input} based on the following context {context}");
      const message = ChatMessagePromptTemplate.fromTemplate("Answer the user's question: {input}.\n based on the following context {context}.\n if you don't know the answer to the question, please reply with 'I Don\'t know'");
  
      console.log("creating chatprompttemplate from message");
      const promptTemplate = ChatPromptTemplate.fromMessages([
        ["ai", "You are a helpful assistant."],
        message,
      ]);
  
  //    const promptTemplate = ChatPromptTemplate.fromTemplate(`Answer the user's question: {input} based on the following context {context}`);
  
      console.log("creating combineDocsChain");
      console.log("prompt.inputVariables: %o", promptTemplate.inputVariables);
      const combineDocsChain = await createStuffDocumentsChain({
        llm: ollama,
        prompt: promptTemplate,
      });
  
      console.log("fetching retriever");
      const retriever = vectorstore.asRetriever();
      
      console.log("createing retrievalchain");
      retrievalChain = await createRetrievalChain({
        combineDocsChain,
        retriever,
      }); 

      console.log("finished initialising the ollama models");

      // end of trying
          // end of langchain-local process

    } catch (err) {
      console.log("failed to invoke retriever: %o", err);
    }

    return ollama;
};

  
