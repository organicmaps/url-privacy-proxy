import { handleRequest } from "./handler"

addEventListener('fetch',(event)=> {
	 return event.respondWith(handleRequest(event.request))
})