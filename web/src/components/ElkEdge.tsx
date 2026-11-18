import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { EDGE_LABEL_PADDING } from "../layout/measureText";
import { fitRoute, midpoint, roundedPath } from "../layout/route";
import type { DeclEdge } from "../graph/toFlow";

/**
 * Draws the route ELK computed. Once a node is dragged the route no longer
 * meets the handles, and the edge falls back to a smooth-step path.
 */
export function ElkEdge(props: EdgeProps<DeclEdge>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label } = props;
  const route = data?.route;
  const points = fitRoute(route, { x: sourceX, y: sourceY }, { x: targetX, y: targetY });

  let path: string;
  let labelX: number;
  let labelY: number;

  if (points) {
    path = roundedPath(points);
    const at = route?.label
      ? { x: route.label.x + route.label.width / 2, y: route.label.y + route.label.height / 2 }
      : midpoint(points);
    labelX = at.x;
    labelY = at.y;
  } else {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });
  }

  return (
    <BaseEdge
      id={props.id}
      path={path}
      markerEnd={props.markerEnd}
      style={props.style}
      interactionWidth={props.interactionWidth}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelBgPadding={[...EDGE_LABEL_PADDING]}
      labelBgBorderRadius={3}
    />
  );
}
