/*
  IMPORTANT: The tsconfig.json has been configured to include "node_modules/cannon/build/cannon.js"
*/
import { Ball } from './ball'
import { getUserData } from '@decentraland/Identity'
import { getCurrentRealm } from '@decentraland/EnvironmentAPI'

// only the last to kick sends ball position data to others
let lastKicker: boolean = false

// how often the lastKicker player sends updates to server, in seconds
const updateInterval = 5

// types of data sent over websockets
export enum dataType {
  POSITION,
  KICK,
}

let userData

// undefined socket object, to define later with realm
let socket

joinSocketsServer()

export async function joinSocketsServer() {
  // keep players in different realms in separate rooms for the ws server
  let realm = await getCurrentRealm()
  log(`You are in the realm: `, realm.displayName)
  // connect to websockets server
  socket = new WebSocket(
    'wss://64-225-45-232.nip.io/broadcast/balls' + realm.displayName
  )

  // for each ws message that arrives
  socket.onmessage = function (event) {
    try {
      const parsed = JSON.parse(event.data)
      log(parsed)

      setBall(parsed)
    } catch (error) {
      log(error)
    }
  }
}

export async function setBall(data: any) {
  // fetch the user id if missing
  if (!userData) {
    userData = await getUserData()
  }
  // ignore messages from the same player
  if (data.user == userData.displayName) return
  if (data.type == dataType.POSITION) {
    balls[data.ball].getComponent(Transform).position.copyFrom(data.pos)
    balls[data.ball].getComponent(Transform).rotation.copyFrom(data.rot)

    ballBodies[data.ball].position = new CANNON.Vec3(
      data.pos.x,
      data.pos.y,
      data.pos.z
    )
    ballBodies[data.ball].quaternion = new CANNON.Quaternion(
      data.rot.x,
      data.rot.y,
      data.rot.z,
      data.rot.w
    )
  } else if (data.type == dataType.KICK) {
    lastKicker = false

    ballBodies[data.ball].position = new CANNON.Vec3(
      data.pos.x,
      data.pos.y,
      data.pos.z
    )
    ballBodies[data.ball].quaternion = new CANNON.Quaternion(
      data.rot.x,
      data.rot.y,
      data.rot.z,
      data.rot.w
    )

    ballBodies[data.ball].applyImpulse(
      new CANNON.Vec3(
        data.vector.x * data.vectorScale,
        data.vector.y * data.vectorScale,
        data.vector.z * data.vectorScale
      ),
      new CANNON.Vec3(
        ballBodies[data.ball].position.x,
        ballBodies[data.ball].position.y,
        ballBodies[data.ball].position.z
      )
    )

    // TODO: adjust for data.timeStamp
  }
}

// Create base scene
const baseScene: Entity = new Entity()
baseScene.addComponent(new GLTFShape('models/baseScene.glb'))
baseScene.addComponent(new Transform())
engine.addEntity(baseScene)

// Ball shapes
const ballShapes: GLTFShape[] = [
  new GLTFShape('models/redBall.glb'),
  new GLTFShape('models/greenBall.glb'),
  new GLTFShape('models/blueBall.glb'),
  //   new GLTFShape('models/pinkBall.glb'),
  //   new GLTFShape('models/yellowBall.glb'),
]

const balls: Ball[] = [] // Store balls
const ballBodies: CANNON.Body[] = [] // Store ball bodies
let ballHeight = 1 // Start height for the balls
let forwardVector: Vector3 = Vector3.Forward().rotate(Camera.instance.rotation) // Camera's forward vector
let vectorScale: number = 100

// Create balls in predefined positions
for (let i = 0; i < ballShapes.length; i++) {
  let positionX: number = 14 + i
  let positionY: number = 1 + i * 3
  let positionZ: number = 14 + i

  const ball = new Ball(
    ballShapes[i],
    new Transform({
      position: new Vector3(positionX, positionY, positionZ),
    })
  )
  balls.push(ball)

  // Allow the player to interact with the ball
  ball.addComponent(
    new OnPointerDown(
      async () => {
        if (!userData) {
          userData = await getUserData()
        }
        // TODO: Apply impluse based on camera and where the ray hits the ball
        // Apply impulse based on the direction of the camera
        ballBodies[i].applyImpulse(
          new CANNON.Vec3(
            forwardVector.x * vectorScale,
            forwardVector.y * vectorScale,
            forwardVector.z * vectorScale
          ),
          new CANNON.Vec3(
            ballBodies[i].position.x,
            ballBodies[i].position.y,
            ballBodies[i].position.z
          )
        )

        // flag player as last kicker to start sending updates
        lastKicker = true

        socket.send(
          JSON.stringify({
            type: dataType.KICK,
            user: userData.displayName,
            ball: i,
            vector: forwardVector.clone(),
            vectorScale: vectorScale,
            pos: ballBodies[i].position.clone(),
            rot: ballBodies[i].quaternion.clone(),
            timeStamp: Date.now(),
          })
        )
      },
      {
        button: ActionButton.ANY,
        showFeedback: true,
        hoverText: 'kick',
      }
    )
  )
}

// Setup our world
const world: CANNON.World = new CANNON.World()
world.gravity.set(0, -9.82, 0) // m/s²

const groundPhysicsMaterial = new CANNON.Material('groundMaterial')
const groundPhysicsContactMaterial = new CANNON.ContactMaterial(
  groundPhysicsMaterial,
  groundPhysicsMaterial,
  {
    friction: 0.5,
    restitution: 0.33,
  }
)
world.addContactMaterial(groundPhysicsContactMaterial)

// Create a ground plane and apply physics material
const groundBody: CANNON.Body = new CANNON.Body({
  mass: 0, // mass == 0 makes the body static
})
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2) // Reorient ground plane to be in the y-axis

const groundShape: CANNON.Plane = new CANNON.Plane()
groundBody.addShape(groundShape)
groundBody.material = groundPhysicsMaterial
world.addBody(groundBody)

const ballPhysicsMaterial: CANNON.Material = new CANNON.Material('ballMaterial')
const ballPhysicsContactMaterial = new CANNON.ContactMaterial(
  groundPhysicsMaterial,
  ballPhysicsMaterial,
  {
    friction: 0.4,
    restitution: 0.75,
  }
)
world.addContactMaterial(ballPhysicsContactMaterial)

// Create bodies to represent each of the balls
for (let i = 0; i < balls.length; i++) {
  let ballTransform: Transform = balls[i].getComponent(Transform)

  const ballBody: CANNON.Body = new CANNON.Body({
    mass: 5, // kg
    position: new CANNON.Vec3(
      ballTransform.position.x,
      ballTransform.position.y,
      ballTransform.position.z
    ), // m
    shape: new CANNON.Sphere(1), // m (Create sphere shaped body with a radius of 1)
  })

  ballBody.material = ballPhysicsMaterial // Add bouncy material to ball body
  ballBody.linearDamping = 0.4 // Round will keep translating even with friction so you need linearDamping
  ballBody.angularDamping = 0.4 // Round bodies will keep rotating even with friction so you need angularDamping

  world.addBody(ballBody) // Add body to the world
  ballBodies.push(ballBody)
}

const fixedTimeStep: number = 1.0 / 60.0 // seconds
const maxSubSteps: number = 3

class updateSystem implements ISystem {
  interval: number = updateInterval

  update(dt: number): void {
    // Instruct the world to perform a single step of simulation.
    // It is generally best to keep the time step and iterations fixed.
    world.step(fixedTimeStep, dt, maxSubSteps)

    // send updated to server at a regular interval
    if (lastKicker) {
      this.interval -= dt
      if (this.interval < 0) {
        this.interval = updateInterval
        for (let i = 0; i < balls.length; i++) {
          socket.send(
            JSON.stringify({
              type: dataType.POSITION,
              user: userData.displayName,
              ball: i,
              pos: balls[i].getComponent(Transform).position.clone(),
              rot: balls[i].getComponent(Transform).rotation.clone(),
            })
          )
        }
      }
    }

    // Position and rotate the balls in the scene to match their cannon world counterparts
    for (let i = 0; i < balls.length; i++) {
      balls[i].getComponent(Transform).position.copyFrom(ballBodies[i].position)
      balls[i]
        .getComponent(Transform)
        .rotation.copyFrom(ballBodies[i].quaternion)
    }

    // Update forward vector
    forwardVector = Vector3.Forward().rotate(Camera.instance.rotation)
    //log('Forward Vector: ', forwardVector)
  }
}

engine.addSystem(new updateSystem())
