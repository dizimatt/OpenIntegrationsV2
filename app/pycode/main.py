# import ollama
import ollama
from langchain_community.document_loaders import PyMuPDFLoader,PDFPlumberLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings

from fastapi import FastAPI, WebSocket
import uvicorn
import json
import logging

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
#def process_pdf(pdf_bytes):
def process_pdf(filepath:str): 
    logger.info(f"starting to process the pdf:{filepath}")
    # ./docs/products_single.pdf

    '''
    if pdf_bytes is None:
        return None, None, None
    
    loader = PyMuPDFLoader(pdf_bytes)
    '''

    loader = PDFPlumberLoader(filepath)  

    data = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, chunk_overlap=100
    )
    chunks = text_splitter.split_documents(data)
    embeddings = OllamaEmbeddings(model="mxbai-embed-large:latest", base_url='http://ollama:11434')
    

    vectorstore = Chroma.from_documents(
        documents=chunks, embedding=embeddings, persist_directory="./chroma_db"
    )
    retriever = vectorstore.as_retriever()
    logger.info("procesed the pdf! you can now proceed...")

    return text_splitter, vectorstore, retriever

def combine_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def ollama_llm(question, context):
    logger.info("about to deepseek with embeddings")
    formatted_prompt = f"Question: {question}\n\nContext: {context}"

    client = ollama.Client(
        host='http://ollama:11434'
    )
    response = client.chat(
        model="deepseek-r1:1.5b",
        messages=[
            {"role": "user", "content": formatted_prompt},
        ],
    )

    response_content = response["message"]["content"]
    logger.info(f"response {response_content}")

    # Remove content between <think> and </think> tags to remove thinking output
    # final_answer = re.sub(r"<think>.*?</think>", "", response_content, flags=re.DOTALL).strip()

    return response_content

def rag_chain(question, text_splitter, vectorstore, retriever):
    retrieved_docs = retriever.invoke(question)
    formatted_content = combine_docs(retrieved_docs)
    return ollama_llm(question, formatted_content)

async def call_ollama(question: str, websocket: WebSocket):
#    text_splitter, vectorstore, retriever = process_pdf("./docs/products_single.pdf")

    if text_splitter is None:
        return None  # No PDF uploaded

    result = rag_chain(question, text_splitter, vectorstore, retriever)
    await manager.send_personal_message(result,websocket)

    return result

app = FastAPI()
manager = ConnectionManager()
logger = logging.getLogger(__name__)
logging.basicConfig(filename='/usr/src/openint-py.log', encoding='utf-8', level=logging.INFO)
#logging.basicConfig(filename='./openint-py.log', encoding='utf-8', level=logging.INFO)
# one-time on-load process to retrieve the files for indexing, and start the ollama server
text_splitter, vectorstore, retriever = process_pdf("./docs/products_single.pdf")

@app.get("/")
def read_root():
    logger.info("running from read_root")
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}


@app.websocket("/api/ollama/send-message-ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await manager.connect(websocket)
        data = await websocket.receive_text()
        data_obj = json.loads(data)

        logger.info(f"about to call ollama with question: {data_obj['question']}")
        results_string = await call_ollama(data_obj["question"], websocket)
        await manager.send_personal_message(f"<aitextdone />",websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.send_personal_message("Bye!!!",websocket)



if __name__ == '__main__':
    print("running from __main__")
#    uvicorn.run(app, host="0.0.0.0", port=8080)
#    process_pdf("./docs/products_single.pdf")