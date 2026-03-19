import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import { formatPct } from "../utils/metrics";

export default function MetricCell({ value, prevValue }) {
  // QUAN TRỌNG: đừng Number(null) vì nó ra 0
  const v = value == null ? NaN : Number(value);
  const pv = prevValue == null ? NaN : Number(prevValue);

  const hasCurr = Number.isFinite(v);
  const hasPrev = Number.isFinite(pv);

  if (!hasCurr) {
    return (
      <Box textAlign="right">
        <Typography variant="body2" fontWeight={700}>-</Typography>
      </Box>
    );
  }

  // không có prev -> neutral
  if (!hasPrev) {
    return (
      <Box textAlign="right">
        <Typography variant="body2" fontWeight={800}>
          {formatPct(v)}
        </Typography>
        <Stack direction="row" spacing={0.25} justifyContent="flex-end" alignItems="center">
          <HorizontalRuleIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 700 }}>
            0.0%
          </Typography>
        </Stack>
      </Box>
    );
  }

  const diff = v - pv;
  const ratio = pv !== 0 ? diff / pv : null;

  const isNeutral =
    Math.abs(diff) < 1e-6 || (ratio != null && Math.abs(ratio) < 1e-4);

  let Icon = HorizontalRuleIcon;
  let color = "text.disabled";
  let deltaText = "0.0%";

  if (!isNeutral) {
    const up = diff > 0;
    Icon = up ? ArrowDropUpIcon : ArrowDropDownIcon;
    color = up ? "success.main" : "error.main";

    deltaText = pv === 0
      ? formatPct(Math.abs(diff))             // absolute khi pv=0
      : (Math.abs(ratio) * 100).toFixed(1) + "%";
  }

  return (
    <Box textAlign="right">
      <Typography variant="body2" fontWeight={800}>
        {formatPct(v)}
      </Typography>

      <Stack direction="row" spacing={0.25} justifyContent="flex-end" alignItems="center">
        <Icon sx={{ fontSize: 16, color }} />
        <Typography variant="caption" sx={{ color, fontWeight: 800 }}>
          {deltaText}
        </Typography>
      </Stack>
    </Box>
  );
}
