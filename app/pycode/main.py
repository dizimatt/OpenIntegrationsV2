from fastapi import FastAPI, WebSocket
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.document_loaders import PDFPlumberLoader  
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.vectorstores import FAISS  
from langchain_ollama import OllamaLLM
import json
# from langchain_core.prompts.prompt import PromptTemplate

class ConnectionManager:
    """Class defining socket events"""
    def __init__(self):
        """init method, keeping track of connections"""
        self.active_connections = []
    
    async def connect(self, websocket: WebSocket):
        """connect event"""
        await websocket.accept()
        self.active_connections.append(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Direct Message"""
        await websocket.send_text(message)
    
    def disconnect(self, websocket: WebSocket):
        """disconnect event"""
        self.active_connections.remove(websocket)

def call_ollama(message):
    print("gotting the docs from the pdf file")
    loader = PDFPlumberLoader("./docs/products.pdf")  
#    loader = PDFPlumberLoader("./docs/products_single.pdf")  
    docs = loader.load() 
    print("got the docs from the pdf file")

    # Split text into semantic chunks  
    text_splitter = SemanticChunker(HuggingFaceEmbeddings())  
    documents = text_splitter.split_documents(docs)
    print("splitted the docs into semantic chunks")

    # Generate embeddings  
    embeddings = HuggingFaceEmbeddings()  
    vector_store = FAISS.from_documents(documents, embeddings)  
    print("generated embeddings")

    # Connect retriever  
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})  # Fetch top 3 chunks
    print ("created retriever")

    llm = OllamaLLM(
        model="deepseek-r1:1.5b",
        base_url="http://ollama:11434",
    )
    print("created llm")

    system_prompt = (
        "Use the given context to answer the question. "
        "If you don't know the answer, say you don't know. "
        "Use three sentence maximum and keep the answer concise. "
        "Context: {context}"
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", "{input}"),
        ]
    )
    print("created chatprompt")

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    print("created documents chain")

    chain = create_retrieval_chain(retriever, question_answer_chain)
    print("attached retriever to the documents chain")

    results = chain.invoke({"input": message})
    print(f"query response: {results}")
    return results

app = FastAPI()
manager = ConnectionManager()

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}


@app.websocket("/api/ollama/send-message-ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        data = await websocket.receive_text()
        data_obj = json.loads(data)
        await manager.send_personal_message(f"Received (nodaemon):{data_obj["question"]}",websocket)
        results = call_ollama(data_obj["question"])
        print (f"results:{results['answer']}")
        await manager.send_personal_message(f"results:{results['answer']}",websocket)
        await manager.send_personal_message(f"<aitextdone />",websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.send_personal_message("Bye!!!",websocket)



if __name__ == '__main__':
    print("running from __main__")

