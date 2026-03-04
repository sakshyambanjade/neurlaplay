/**
 * ChessArmMapper - Maps chess moves to robot arm trajectories
 * 
 * Pipeline: Chess move (e2e4) → SNN confidence → Cartesian trajectory
 * Robot: UR5 (6-DOF collaborative arm) or Franka Emika Panda
 * 
 * Workspace: 0.3-0.5m X, -0.3-0.3m Y, 0.05-0.15m Z
 * (In front of chess board with safe approach angles)
 */

export interface RobotTrajectory {
  waypoints: Array<[number, number, number, number, number, number]>;  // [x,y,z,rx,ry,rz] in meters and radians
  chessMove: string;  // UCI notation (e.g., "e2e4")
  pieceType?: string;  // "pawn", "knight", etc.
  confidence: number;  // SNN spike efficiency
  duration: number;  // Total execution time in seconds
  description: string;
}

/**
 * Trajectory segment for detailed motion planning
 */
interface TrajectorySegment {
  phase: 'approach' | 'contact' | 'grasp' | 'lift' | 'transit' | 'place' | 'retract';
  position: [number, number, number];
  orientation: [number, number, number];  // rx, ry, rz
  duration: number;
}

/**
 * ChessArmMapper Class
 * Converts chess board coordinates to robot workspace coordinates
 * Generates smooth 5-waypoint trajectories for chess piece manipulation
 */
export class ChessArmMapper {
  private boardToWorkspace: Map<string, [number, number, number]>;
  private readonly BOARD_MIN_X = 0.3;
  private readonly BOARD_MAX_X = 0.5;
  private readonly BOARD_MIN_Y = -0.3;
  private readonly BOARD_MAX_Y = 0.3;
  private readonly BOARD_MIN_Z = 0.05;
  private readonly BOARD_MAX_Z = 0.15;
  private readonly GRIPPER_OFFSET = 0.05;  // Approach height above pieces

  constructor() {
    // Map chess squares (a1-h8) to robot workspace coordinates
    this.boardToWorkspace = new Map();
    
    for (let file = 0; file < 8; file++) {
      for (let rank = 0; rank < 8; rank++) {
        // Chess notation: a1 is (0,0), h8 is (7,7)
        const square = String.fromCharCode(97 + file) + (rank + 1);
        
        // Linear interpolation across workspace
        const x = this.BOARD_MIN_X + (file / 7) * (this.BOARD_MAX_X - this.BOARD_MIN_X);
        const y = this.BOARD_MIN_Y + (rank / 7) * (this.BOARD_MAX_Y - this.BOARD_MIN_Y);
        const z = this.BOARD_MIN_Z + (rank / 8) * (this.BOARD_MAX_Z - this.BOARD_MIN_Z);
        
        this.boardToWorkspace.set(square, [x, y, z]);
      }
    }
  }

  /**
   * Map a chess move (UCI notation) to a smooth robot trajectory
   * 
   * Trajectory phases:
   * 1. Approach - Move above source square
   * 2. Grasp - Descend to piece
   * 3. Lift - Retract with piece grasped
   * 4. Transit - Move above destination
   * 5. Place - Descend and release
   */
  mapChessMove(uci: string, confidence: number, pieceType: string = 'pawn'): RobotTrajectory {
    const fromSquare = uci.slice(0, 2);
    const toSquare = uci.slice(2, 4);

    const fromPos = this.boardToWorkspace.get(fromSquare);
    const toPos = this.boardToWorkspace.get(toSquare);

    if (!fromPos || !toPos) {
      throw new Error(`Invalid chess squares: ${fromSquare} or ${toSquare}`);
    }

    // Build 5-waypoint trajectory with smooth transitions
    const waypoints: Array<[number, number, number, number, number, number]> = [
      // Waypoint 1: Approach - Above source square, gripper open
      [fromPos[0], fromPos[1], fromPos[2] + this.GRIPPER_OFFSET, 0, Math.PI, 0],
      
      // Waypoint 2: Grasp - Descend to piece surface, gripper closes
      [fromPos[0], fromPos[1], fromPos[2], 0, Math.PI, 0],
      
      // Waypoint 3: Lift - Retract 5cm above board, gripper holding piece
      [fromPos[0], fromPos[1], fromPos[2] + this.GRIPPER_OFFSET * 1.5, 0, Math.PI, 0],
      
      // Waypoint 4: Transit - Move above destination square (straight path)
      [toPos[0], toPos[1], fromPos[2] + this.GRIPPER_OFFSET * 1.5, 0, Math.PI, 0],
      
      // Waypoint 5: Place - Lower onto destination, gripper opens
      [toPos[0], toPos[1], toPos[2], 0, Math.PI, 0]
    ];

    // Calculate total duration: ~500ms per waypoint + variance by confidence
    const baseDuration = waypoints.length * 0.5;
    const confidenceBonus = confidence * 0.2;  // Faster execution with higher confidence
    const totalDuration = baseDuration - Math.min(confidenceBonus, 0.3);

    return {
      waypoints,
      chessMove: uci,
      pieceType,
      confidence,
      duration: totalDuration,
      description: `Move ${pieceType} from ${fromSquare} to ${toSquare} (confidence: ${(confidence * 100).toFixed(1)}%)`
    };
  }

  /**
   * Generate detailed trajectory segments for visualization/analysis
   */
  getTrajectorySegments(trajectory: RobotTrajectory): TrajectorySegment[] {
    const segments: TrajectorySegment[] = [];
    const phases: Array<'approach' | 'contact' | 'grasp' | 'lift' | 'transit' | 'place' | 'retract'> = [
      'approach',
      'contact',
      'grasp',
      'lift',
      'transit',
      'place'
    ];

    trajectory.waypoints.forEach((waypoint, index) => {
      segments.push({
        phase: phases[Math.min(index, phases.length - 1)],
        position: [waypoint[0], waypoint[1], waypoint[2]],
        orientation: [waypoint[3], waypoint[4], waypoint[5]],
        duration: trajectory.duration / trajectory.waypoints.length
      });
    });

    return segments;
  }

  /**
   * Validate trajectory for kinematic feasibility
   * (Simplified check - real implementation would use FK/IK)
   */
  isTrajectoryFeasible(trajectory: RobotTrajectory): boolean {
    for (const waypoint of trajectory.waypoints) {
      const [x, y, z] = waypoint;
      
      // Check workspace bounds
      if (x < this.BOARD_MIN_X || x > this.BOARD_MAX_X) return false;
      if (y < this.BOARD_MIN_Y || y > this.BOARD_MAX_Y) return false;
      if (z < this.BOARD_MIN_Z || z > this.BOARD_MAX_Z) return false;
    }
    
    return true;
  }

  /**
   * Export trajectory as ROS-compatible format
   */
  exportToROS(trajectory: RobotTrajectory): {
    joint_trajectory: {
      points: Array<{ positions: number[]; time_from_start: { secs: number; nsecs: number } }>;
    };
  } {
    return {
      joint_trajectory: {
        points: trajectory.waypoints.map((wp, index) => ({
          positions: wp,  // x, y, z, rx, ry, rz
          time_from_start: {
            secs: Math.floor((trajectory.duration / trajectory.waypoints.length) * (index + 1)),
            nsecs: ((trajectory.duration / trajectory.waypoints.length) * (index + 1) % 1) * 1e9
          }
        }))
      }
    };
  }

  /**
   * Export trajectory as UR5 Script format
   */
  exportToURScript(trajectory: RobotTrajectory): string {
    let script = `# Chess Move: ${trajectory.description}\n`;
    script += `# Duration: ${trajectory.duration.toFixed(2)}s\n\n`;

    trajectory.waypoints.forEach((wp, index) => {
      const [x, y, z, rx, ry, rz] = wp;
      script += `movep(p[${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}, ${rx.toFixed(4)}, ${ry.toFixed(4)}, ${rz.toFixed(4)}], a=1.2, v=0.25, t=0, r=0)\n`;
    });

    script += `\n# Gripper open command\n`;
    script += `gripper_open(width=0.08, speed=0.1)\n`;

    return script;
  }

  /**
   * Get workspace statistics for research paper
   */
  getWorkspaceStats(): {
    boardSquares: number;
    workspaceVolume: number;
    maxReach: number;
    avgWaypointsPerMove: number;
  } {
    const volume = 
      (this.BOARD_MAX_X - this.BOARD_MIN_X) *
      (this.BOARD_MAX_Y - this.BOARD_MIN_Y) *
      (this.BOARD_MAX_Z - this.BOARD_MIN_Z);

    const maxReach = Math.sqrt(
      Math.pow(this.BOARD_MAX_X - this.BOARD_MIN_X, 2) +
      Math.pow(this.BOARD_MAX_Y - this.BOARD_MIN_Y, 2) +
      Math.pow(this.BOARD_MAX_Z - this.BOARD_MIN_Z, 2)
    );

    return {
      boardSquares: 64,
      workspaceVolume: Math.round(volume * 1e6) / 1e6,  // m³
      maxReach: Math.round(maxReach * 1000) / 1000,  // meters
      avgWaypointsPerMove: 5
    };
  }
}

/**
 * Helper function to validate and parse UCI notation
 */
export function parseUCI(uci: string): { from: string; to: string; promotion?: string } | null {
  if (uci.length < 4 || uci.length > 5) return null;
  
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;

  // Validate square notation (a-h, 1-8)
  const isValidSquare = (sq: string) => {
    return /^[a-h][1-8]$/.test(sq);
  };

  if (!isValidSquare(from) || !isValidSquare(to)) return null;

  return { from, to, promotion };
}

/**
 * Helper function to calculate trajectory smoothness
 * (Used for research metrics)
 */
export function calculateTrajectorySmoothnessMetric(trajectory: RobotTrajectory): number {
  let totalDeviation = 0;
  
  for (let i = 1; i < trajectory.waypoints.length - 1; i++) {
    const prev = trajectory.waypoints[i - 1];
    const curr = trajectory.waypoints[i];
    const next = trajectory.waypoints[i + 1];

    // Simple curvature approximation
    const d1 = Math.sqrt(
      Math.pow(curr[0] - prev[0], 2) +
      Math.pow(curr[1] - prev[1], 2) +
      Math.pow(curr[2] - prev[2], 2)
    );
    
    const d2 = Math.sqrt(
      Math.pow(next[0] - curr[0], 2) +
      Math.pow(next[1] - curr[1], 2) +
      Math.pow(next[2] - curr[2], 2)
    );

    // High smoothness = distances are similar across waypoints
    totalDeviation += Math.abs(d1 - d2);
  }

  // Smoothness metric: 0 (perfect straight line) to 1.0
  return Math.max(0, 1 - (totalDeviation / trajectory.waypoints.length) * 0.5);
}
