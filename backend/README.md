# Backend workspace

The backend teammate may add a Node/Express service or another agreed stack here. No backend dependencies or server implementation are installed yet.

Keep this directory independent from browser motion modules. Browser code reaches a future service through `src/api.js` only. See [BACKEND_GUIDE.md](../BACKEND_GUIDE.md) for the result contract, API functions, and data restrictions. Store database credentials and signing secrets in environment variables, never in the repository.
