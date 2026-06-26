# Lottery Scratcher Agent

I want to build a Lottery Scratcher Agent that can answer questions about Lottery Scratcher games in a user's home state, particularly around probability and statistics and providing recommendations for which scratchers to buy. I have a database with different tables that update prize remaining data for five states For all of their lottery scratchers that are publicly provided by the lottery state Lottery Association website. The idea for this is to make a flexible agent that can answer questions about games as well as compare games, get recommendations, etc. The goal of this is also to learn how to structure information for an agent when it's anticipating different kinds of questions from a user, so that I'm prepared to do this for larger domains or multiple-domain projects. 

The tools that I will provide the agent consist of basically three different types that just kind of help conceptualize what they are:
1. SQL query tools that query the database tables so that the agent doesn't have direct access to the database.
2. Tools with that compute certain metrics, or at the very least grab the computed metric value from the database table, basically doing some computations on the data 
3. Visualization tools that allow the agent to create standard visualizations for the computed metrics and present them to the user in a way that uses a predetermined style and aesthetic. This is to help the user see visually the difference between games or see visually a game's odds profile, because a lot of times, with average lottery players who are non-technical, there's just a lot of probability and statistics and it's hard to understand. This makes the response visually appealing. 

I want to build this such that this is like a prototype of a tool. Part of building this is having some web page or front-end view of a chat that I can chat with the agent and visually test and experiment and see its response to continue refining the agent. An additional part of this is that I'm practicing tracing tool calls. All of the tool calls need to be extremely readable, and I don't really want there to be too many hidden actions. Next to this frontend chat view, I want to also be able to eventually see in real time what the cognitive path, the decision, or the reasoning path that the agent took to answer a question using the tool calls as tracing. 

This isn't supposed to be a super complex project. It's supposed to be an MVP, and the first version of this I want it to be vanilla in the sense that the system prompt contains domain knowledge, domain context, , and response and output guidelines. I'm not over-engineering with any intent routing, so for example, if the user asks for a recommendation, there is no explicit routing that explains to the agent how to reason through this question yet. The vanilla version is just feeding the agent a bunch of tools with descriptions and first observing how it utilizes those via tool call tracing, and then refining and adding routing and additional guidelines as necessary. 

See key files below. The calculated_metrics_reference file is for compiling the available metrics that we have, where they can be found in the table, and what they mean. I also include a full schema of the database. There's also a file for foundational lottery domain knowledge. 


## Project Docs Index

What's in the `docs/` folder.

- **agent-structure.md** — Technical reference for how a tool-using chat agent is wired, including components, connections, request payloads, and local prototype setup.
- **agent-brain-principles.md** — Guiding principles for building the agent brain, synthesizing domain knowledge and user journeys into a layered analytics system.
- **vanilla-agent-components.md** — Description of the first agent build using just tools and a system prompt as a baseline, before intent routing or skill loading.
- **agent-response-guidelines.md** — Hard rules and behavioral guidelines for the agent's system prompt, covering tone, honesty about odds, and how to handle user queries.
- **calculated_metrics_reference.md** — Index of all calculated metrics with their formulas, table/field locations, and groupings by how they relate to each other.
- **database_schema_reference.md** — Reference for all database tables, their purpose, and every field with type and description.
- **domain-knowledge.md** — Foundational lottery concepts, metric meanings, and decision-making context for the agent.
- **visualization-reference.md** — Portable reference for recreating all metric visualization components using Recharts, with full source code and design system specs.

## Implementation

In the `docs/` folder I have the agent-structure.md file to explain how I want to technically set up this MVP with the frontend and the chat agent. This should be run locally. We're not going to push this to excel or Vercel server or anything like that. 

Then there's the agent-brain-principles.md file, which is going to be guiding principles for building the agent brain and how to synthesize domain knowledge and reflect user journeys in analytics systems. 

And then I have a vanilla-agent-components.md file which describes the first agent build to use to start out with our baseline agent.

### Implementation ORder

1. I think priority is going to be getting our files organized. We have to make sure we have good documentation. We need to have good descriptions for our tools. We need to have reference files that explain metrics that the agent can look up, and that's going to be the priority. It's just getting all of our files in place, making sure everything's clean, using the context files I provide in the docs folder. This is also going to require really honing in on what tools we're using and defining, and making sure the database tables are queried correctly. 
2. But when we go to test it, we do need some simple front-end chat. I need to be able to open up a dev server and be able to test this agent visually because I want to be able to see the responses that it's providing. Particularly if it's using the visualization tools that I provide and what that output looks like and how it renders. This basic front end is going to have to be compatible with recharts. If it's not compatible, then we're going to have to integrate some step that reconsiders how we do these visualizations. 
3. We're going to test and refine the agent Using tool tracing to be able to map what tools the agent is calling for what questions, and to be able to dissect where it's going wrong and where guardrails need to be placed. 
4. Refine agent, making sure it answers questions, making sure its output is beautiful, the visualizations render well, and it follows the response guidelines correctly. 
4. Then we can refine the front end application with the chat to include the tool tracing Visually, in real time, along with the chat. I want this to be a really beautiful demo of this tool. It doesn't need to be production quality. We're not going to ship this to a website, but it needs to be a beautiful demo for a portfolio piece. 
