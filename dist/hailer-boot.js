/* Loads the Hailer App SDK and hands it to app.js, which connects to Hailer when the app is opened inside it. */
import { HailerApi } from "./vendor/app-sdk.js";
window.HailerApi = HailerApi;
