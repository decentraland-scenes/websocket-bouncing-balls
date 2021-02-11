# Websockets and physics scene

_demo of cannon-example-scene running in preview._

![demo](https://github.com/decentraland-scenes/cannon-example-scene/blob/master/screenshots/cannon.gif)

## Description

This scene uses WebSockets to sync what each player sees while simulating a bunch of balls bouncing using the [cannon.js](https://github.com/schteppe/cannon.js) physics engine.

Since physics is calculated client side, sending messages for each change of position would be too much. Here, we're just sharing information about any exherted forces on the balls, and each client then calculates the effects of that locally.

Small delays might lead to balls being in slightly different positions, and could deal to discrepancies, especially when balls bounce off each other, so it's important to deal with that in some way.

In this case, the last player to have kicked a ball is assigned as the source of truth, and syncs the position of all balls in the scene to others every couple of seconds. 

This scene uses the default echo websockets server, which simply forwards all messages received to all other players in the room. A more robustly developed scene might implement server-side logic to dissambiguate confiting data better, or even run a parallel phyisics simulation and take that as the final source of truth. The benefit of this implementation is that it doesn't require changing the server-side code at all, but it has its limitations.

## Try it out

**Install the CLI**

Download and install the Decentraland CLI by running the following command:

```bash
npm i -g decentraland
```

**Previewing the scene**

Download this example and navigate to the `scene` directory, then run:

```
$:  dcl start
```

Any dependencies are installed and then the CLI opens the scene in a new browser tab.

**Run the server**

By default, the scene relies on an already deployed server on that can be reached on `wss://64-225-45-232.nip.io/`

To instead run the server locally, on a separate command line window, navigate to the `server` directory and run the following command to install all the dependencies:

```
npm i
```

Once the dependencies are installed, run the following command to start the server:

```
npm run start
```

The server will then be listening on `localhost:8080`, you can redirect the scene to point to this address when connecting to the WS server.

```

socket = new WebSocket(
    'wss://localhost:8080/broadcast/' + realm.displayName
  )
```

**Scene Usage**

Use the Left Mouse Button or 'E' or 'F' keys to interact with the balls.  If you open multiple tabs to the same preview, you should see that all tabs respond to the changes that other players do too. These messages are travelling via WebSockets.

