from fastapi import FastAPI

app = FastAPI(title="Estoca")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
