## LoadFire

LoadFire is an easy to script load balancer and reverse proxy in NodeJS.

It allows you to write your own pieces of logic as "Patterns" and the core engine takes care of all the proxying logic so you don't have to worry about it.

#The real power is that all it's behavior is entirely scriptable in JavaScript (NodeJS). :)#

###This allows for many different use cases, such as:
  - Dynamic realtime proxying rules (domain mappings stored in Redis for example). Such things are useful for PaaSs 
  - Add pieces of middleware to your reverse proxy
  - Customizable load balancing patterns (Sticky, RoundRobin, ...)

###It supports proxying:
  - HTTP/HTTPS
  - WebSockets
 
It was initially built to satisfy our needs at FriendCode, and we've been using it in product for months without any issues, so it can be considered as stable.

The API however should be expected to improve greatly over time.
