// TrainModelPage/components/TestingHistoryTable.jsx
import React from "react";
import {
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Typography, Chip, Stack, IconButton, Tooltip, Box,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";

import MetricCell from "./MetricCell";
import { getStatusChipColor } from "../utils/getStatusChipColor";
import { formatDate, renderBestMetric } from "../utils/metrics";
import { downloadModel } from "../../../api";

export default function TestingHistoryTable({
  rows,
  onView,
  onDelete,
}) {
  return (
    <TableContainer sx={{ maxHeight: "calc(100vh - 250px)" }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 60, fontWeight: 800 }}>ID</TableCell>
            <TableCell sx={{ minWidth: 240, fontWeight: 800 }}>Session Name</TableCell>
            <TableCell sx={{ width: 110, fontWeight: 800 }}>Status</TableCell>
            <TableCell align="right" sx={{ width: 110, fontWeight: 800 }}>Best Metric</TableCell>
            <TableCell align="right" sx={{ width: 130, fontWeight: 800 }}>F1</TableCell>
            <TableCell align="right" sx={{ width: 130, fontWeight: 800 }}>Precision</TableCell>
            <TableCell align="right" sx={{ width: 130, fontWeight: 800 }}>Recall</TableCell>
            <TableCell align="center" sx={{ width: 130, fontWeight: 800 }}>Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  No testing sessions found
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="700">#{row.id}</Typography>
                </TableCell>

                <TableCell>
                  <Stack spacing={0.6}>
                    <Typography variant="body2" fontWeight="800">
                      {row.session_name || "(no session name)"}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={row.task_type === "detection" ? "Detection" : "Classification"}
                        color={row.task_type === "detection" ? "success" : "primary"}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                    </Stack>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ScheduleIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(row.created_at)}
                      </Typography>
                    </Stack>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Chip
                    label={row.status}
                    color={getStatusChipColor(row.status)}
                    size="small"
                    sx={{ fontWeight: 700, textTransform: "capitalize" }}
                  />
                </TableCell>

                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight="800"
                    color={row.status === "finished" ? "primary" : "text.secondary"}
                  >
                    {renderBestMetric(row.metrics, row.task_type)}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <MetricCell value={row.f1} prevValue={row.prev_f1} />
                </TableCell>
                <TableCell align="right">
                  <MetricCell value={row.precision} prevValue={row.prev_precision} />
                </TableCell>
                <TableCell align="right">
                  <MetricCell value={row.recall} prevValue={row.prev_recall} />
                </TableCell>

                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="View Details">
                      <IconButton size="small" color="primary" onClick={() => onView(row.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={row.model_path ? "Download Model" : "No model available"}>
                      <span>
                        <IconButton
                          size="small"
                          color="success"
                          disabled={!row.model_path}
                          onClick={() => downloadModel(row.model_path)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Delete Session">
                      <IconButton size="small" color="error" onClick={() => onDelete(row.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
