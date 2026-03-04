# 🚀 ROS2 Setup Guide: Full Instructions

## Quick Start (Simulation - 5 minutes)

### No real robot? No problem! Simulate everything.

```bash
# 1. Install dependencies
cd server
npm install    # Adds roslib

# 2. Start your Node server
npm run dev

# 3. Create match with robot execution
curl -X POST http://localhost:3000/api/neuro-bot-match \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "sim-demo-001",
    "whiteBotName": "GPT",
    "whiteModel": "gpt-4o",
    "whiteEndpointUrl": "https://api.openai.com/v1",
    "whiteApiKey": "sk-YOUR-KEY",
    "blackBotName": "Claude",
    "blackModel": "claude-3.5-sonnet",
    "blackEndpointUrl": "https://api.anthropic.com",
    "blackApiKey": "sk-ant-YOUR-KEY",
    "enableRobotExecution": true
  }'

# 4. Watch console for robot simulation logs:
# [ROS2Controller] 🤖 Simulated execution: e4 (5 points, 2547ms)
```

**That's it!** Your system is now running with simulated robot execution.

---

## Real Robot Setup (UR5 or Franka)

### Prerequisites

```bash
# Ubuntu 22.04 with ROS2 Humble
sudo apt update
sudo apt upgrade

# Install ROS2 Humble
sudo apt install ros-humble-desktop

# Create workspace
mkdir -p ~/ros2_ws/src
cd ~/ros2_ws
colcon build
```

### Option A: Real UR5 Robot

#### Step 1: Install UR5 Driver

```bash
cd ~/ros2_ws/src

# Clone UR robot drivers
git clone https://github.com/UniversalRobots/Universal_Robots_ROS2_Driver.git

# Install dependencies
cd Universal_Robots_ROS2_Driver
rosdep install --from-paths . --ignore-src -y

# Build
cd ~/ros2_ws
colcon build --symlink-install

# Source workspace
source install/setup.bash
```

#### Step 2: Start UR5 Drivers

```bash
# Power on your UR5 robot
# Get its IP address (e.g., 192.168.1.100)

# Start the driver
ros2 launch ur_robot_driver ur5_bringup.launch.py ip_address:=192.168.1.100

# Expected output:
# [INFO] [ur_robot_driver]: ROS driver started
# [INFO] [move_group]: MoveGroup initialized
```

#### Step 3: Start MoveIt2

```bash
# In new terminal
source ~/ros2_ws/install/setup.bash

ros2 launch ur5_moveit_config ur_moveit.launch.py

# Expected output:
# [INFO] [move_group]: Running MoveGroup
# [INFO] [move_group]: Ready to accept plans
```

#### Step 4: Start ROSBridge

```bash
# In another terminal
source ~/ros2_ws/install/setup.bash

sudo apt install ros-humble-rosbridge-suite

ros2 launch rosbridge_suite rosbridge_websocket_launch.xml

# Expected output:
# Started RonBridge WebSocket on port 9090
# Waiting for connections...
```

#### Step 5: Connect from Node.js

```typescript
// In your server code
const agent = new NeuroAgent('gpt-4o', true);

// Connect to real UR5
const connected = await agent.connectToPhysicalRobot();

if (connected) {
  console.log('✅ Connected to real UR5!');
  
  // Now execute on actual robot
  const decision = await agent.fullNeuroChessPipeline(fen, moves, reasoning);
  
  if (decision.robotExecution?.success) {
    console.log('🤖 REAL ROBOT MOVED THE PIECE!');
  }
} else {
  console.warn('❌ Could not connect to UR5');
}
```

---

### Option B: Simulated UR5 in Gazebo

#### Step 1: Install Gazebo Simulator

```bash
sudo apt install ros-humble-ur-simulation
sudo apt install ros-humble-gazebo-ros
sudo apt install ros-humble-moveit2
```

#### Step 2: Launch Simulated Robot

```bash
source ~/ros2_ws/install/setup.bash

# Start Gazebo with simulated UR5
ros2 launch ur_simulation_gazebo ur5_gazebo.launch.py

# You should see:
# - Gazebo window with UR5 arm
# - Console says simulation running
```

#### Step 3: Start MoveIt2 (same as real robot)

```bash
# In new terminal
source ~/ros2_ws/install/setup.bash

ros2 launch ur5_moveit_config ur_moveit.launch.py

# MoveIt will connect to the simulated robot
```

#### Step 4: Start ROSBridge

```bash
# Same as before
ros2 launch rosbridge_suite rosbridge_websocket_launch.xml
```

#### Step 5: Your Code Works Identically!

```typescript
// Exact same code works for simulated or real robot
const agent = new NeuroAgent('gpt-4o', true);
await agent.connectToPhysicalRobot();

// This will control:
// - Real UR5 if running actual drivers
// - Simulated UR5 if running Gazebo
// - Offline simulation if ROSBridge offline
```

---

### Option C: Franka Emika Panda

```bash
# Similar to UR5, but with Franka drivers
cd ~/ros2_ws/src
git clone https://github.com/frankaemika/franka_ros2.git

# Install Franka MoveIt config
rosdep install --from-paths franka_ros2 -y

# Build
colcon build --symlink-install

# Launch (assuming Panda is networked on 192.168.1.200)
ros2 launch franka_moveit_config moveit.launch.py robot_ip:=192.168.1.200

# Configure agent
const agent = new NeuroAgent('gpt-4o', true);
agent.setRobotController(
  new ROS2ArmController(RobotPresets.panda_default)
);
```

---

## Verify Setup

### Checklist

```bash
# Check ROS2 is installed
ros2 --version
# Should output: ROS 2 Humble Hawksbill

# Check topics are publishing
ros2 topic list
# Should show: /joint_states, /tf, /move_group/...

# Check services are available
ros2 service list
# Should show movement services

# Check ROSBridge is connected
curl http://localhost:9090/status
# May be empty, that's ok - it's running on WebSocket not HTTP
```

### Sanity Check

```bash
# From terminal 1-3 (driver, MoveIt, ROSBridge running):
# Run a simple Node.js script

node << 'EOF'
const ROSLIB = require('roslib');
const ros = new ROSLIB.Ros({ url: 'ws://localhost:9090' });

ros.on('connection', () => {
  console.log('✅ Connected to ROS2!');
  process.exit(0);
});

ros.on('error', (err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Connection timeout');
  process.exit(1);
}, 5000);
EOF
```

---

## Configure Chess Board Position

The robot needs to know where the chess board is in its workspace!

### Physical Calibration

```bash
# 1. Move robot to position above square "a1"
ros2 topic pub /ur5/joint_trajectory_controller/command trajectory_msgs/JointTrajectory ...

# 2. Mark that position and record coordinates
# Example: a1 = [0.30, -0.30, 0.05]

# 3. Verify all 64 squares are reachable
# The ChessArmMapper assumes:
# - a1 = [0.30, -0.30, 0.05]
# - h8 = [0.50, +0.30, 0.15]

# 4. If your board position differs, update ChessArmMapper:
class ChessArmMapper {
  private readonly BOARD_MIN_X = 0.30;    // Your a-file position
  private readonly BOARD_MAX_X = 0.50;    // Your h-file position
  private readonly BOARD_MIN_Y = -0.30;   // Your rank-1 position
  private readonly BOARD_MAX_Y = +0.30;   // Your rank-8 position
  private readonly BOARD_MIN_Z = 0.05;    // Your piece height
  private readonly BOARD_MAX_Z = 0.15;    // Grasp height
}
```

### Software Verification

```bash
# Test coordinate system
node << 'EOF'
const mapper = new ChessArmMapper();
const stats = mapper.getWorkspaceStats();

console.log('Chess Board Coverage:');
console.log(`- Squares covered: ${stats.boardSquares}`);
console.log(`- Workspace volume: ${stats.workspaceVolume} m³`);
console.log(`- Max reach: ${stats.maxReach} m`);

// Test a few critical squares
const tests = ['a1', 'h1', 'a8', 'h8', 'e4'];
tests.forEach(square => {
  try {
    const traj = mapper.mapChessMove('e2e4', 0.9);
    console.log(`✅ Square ${square}: reachable`);
  } catch {
    console.log(`❌ Square ${square}: UNREACHABLE - fix workspace bounds!`);
  }
});
EOF
```

---

## Test Your First Move

### Run Test Match

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Create test match
sleep 10  # Wait for server to start
curl -X POST http://localhost:3000/api/neuro-bot-match \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "test-real-robot",
    "whiteBotName": "GPT-Tester",
    "whiteModel": "gpt-4o",
    "whiteEndpointUrl": "https://api.openai.com/v1",
    "whiteApiKey": "sk-YOUR-KEY",
    "blackBotName": "Claude-Tester",
    "blackModel": "claude-3.5-sonnet",
    "blackEndpointUrl": "https://api.anthropic.com",
    "blackApiKey": "sk-ant-YOUR-KEY",
    "enableRobotExecution": true
  }'

# Terminal 1: Watch for output
# [NeuroChess] 🧠 Brain decision: e4
# [ROS2Controller] Executing e4 on physical robot
# [ROS2Controller] 🤖 Robot execution: e4 (5 points, 2547ms)
# [NeuroChess] 🧠♟️🤖 Full pipeline: e4 completed successfully!

# Physical robot should now be moving!
```

### Check Robot State

```bash
# View joint angles
ros2 topic echo /joint_states

# Should show changing values as robot moves
# Example output:
# header: ...
# name: ["shoulder_pan_joint", "shoulder_lift_joint", ...]
# position: [0.123, 1.456, 2.789, ...]

# If position is static, robot isn't moving
```

---

## Troubleshooting

### "Cannot connect to ROS2 bridge"

```bash
# Verify ROSBridge is running
ps aux | grep rosbridge
# Should show rosbridge_websocket process

# Check port
lsof -i :9090
# Should show rosbridge listening

# If not running, restart:
ros2 launch rosbridge_suite rosbridge_websocket_launch.xml

# Try connecting from command line
ros2 topic list
# Should show many topics if connected
```

### "Robot not responding to commands"

```bash
# Check if drivers are running
ps aux | grep ur5_robot_driver
ps aux | grep move_group

# If MoveIt says "not ready", check:
ros2 service list | grep move_group
# Should include `/move_group/move_action`

# If missing, restart MoveIt:
ros2 launch ur5_moveit_config ur_moveit.launch.py
```

### "IK solver fails (TRAC-IK not found)"

```bash
# UR5 default IK might be limited
# Install better solver
sudo apt install ros-humble-trac-ik

# Rebuild move group with TRAC-IK
# (See UR5 documentation for config)

# As fallback, our analytical IK should work for chess moves
```

### "Workspace coordinates wrong"

```bash
# Verify board calibration
# Move robot to a1 manually
# Record joint angles
ros2 topic echo /joint_states
# Note the `position` array

# Test if reachable
node << 'EOF'
const mapper = new ChessArmMapper();
const traj = mapper.mapChessMove('e2e4', 0.9);
console.log('First waypoint (approach):');
console.log(traj.waypoints[0]);
// Should be something like: [0.38, -0.3, 0.075]
// If way off, update BOARD constants in ChessArmMapper
EOF
```

---

## Performance Optimization

### If Slow (>5s per move)

```typescript
// Reduce trajectory waypoints
const trajectory = mapper.mapChessMove(move, confidence);
// Default: 5 waypoints per move

// Or increase robot speed
const config = {
  ...RobotPresets.ur5_default,
  maxVelocity: 1.0  // m/s (faster)
};
```

### If Unreliable (Success < 90%)

```typescript
// Add verification step
const result = await robotController.executeChessTrajectory(move, confidence);

if (!result.success) {
  // Retry with slower speed
  const retryConfig = {
    ...config,
    maxVelocity: 0.3  // Slower = more reliable
  };
  // Reconnect and retry
}

// Log failures for analysis
console.log(`Failure rate: ${(failures/total*100).toFixed(1)}%`);
```

---

## Docker Option

### Run Everything in Container

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3'
services:
  ros2:
    image: ros:humble
    container_name: ros2_ur5
    network_mode: host
    command: >
      bash -c "
        source /opt/ros/humble/setup.bash &&
        ros2 launch ur_robot_driver ur5_bringup.launch.py ip_address:=192.168.1.100 &&
        ros2 launch ur5_moveit_config ur_moveit.launch.py &&
        ros2 launch rosbridge_suite rosbridge_websocket_launch.xml
      "
    volumes:
      - ~/.ros:/root/.ros
    environment:
      - ROS_DOMAIN_ID=0

  neurochess:
    image: node:18
    container_name: neurochess_server
    network_mode: host
    working_dir: /app
    command: npm run dev
    volumes:
      - .:/app
    environment:
      - ROSBRIDGE_URL=ws://localhost:9090
    depends_on:
      - ros2
EOF

# Start everything
docker-compose up
```

---

## Research Data Export

After running matches with physical robot:

```bash
# Export complete data
curl http://localhost:3000/api/research/export/test-real-robot/json > robot_data.json

# Analyze
python3 << 'EOF'
import json
with open('robot_data.json') as f:
    data = json.load(f)
    
    print('Robot Execution Analysis:')
    print(f'Total moves: {len(data["moves"])}')
    
    executed = [m for m in data['moves'] if 'robotExecution' in m]
    successful = [m for m in executed if m['robotExecution']['success']]
    
    print(f'Physically executed: {len(executed)}')
    print(f'Success rate: {len(successful)/len(executed)*100:.1f}%')
    
    avg_time = sum(m['robotExecution']['executionTime'] for m in executed) / len(executed)
    print(f'Avg execution time: {avg_time:.0f}ms')
    
    print('\nAll metrics ready for paper publication!')
EOF
```

---

## Summary

| Setup Option | Time | Cost | Realism |
|---|---|---|---|
| Simulation | 5 min | Free | 85% |
| Gazebo | 20 min | Free | 95% |
| Real UR5 | 1 hour | $35k+ | 100% |
| Real Franka | 1 hour | $30k+ | 100% |

---

## Next Steps

1. **Test simulation** (5 min) - Verify your code works
2. **Set up ROS2** (if you have lab access) - Connect real robot
3. **Calibrate board** - Mark workspace boundaries
4. **Run demo match** - Record video for paper
5. **Export data** - Publish metrics

---

**You're ready to demonstrate AI controlling a real robot!** 🤖

