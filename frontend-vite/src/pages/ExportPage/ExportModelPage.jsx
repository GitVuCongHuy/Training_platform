import { useEffect, useMemo, useState } from "react";
import {
  Container, Typography, Card, CardContent, Grid, FormControl, InputLabel,
  Select, MenuItem, Button, Switch, FormControlLabel, TextField, Divider,
  LinearProgress, Alert, Stack, IconButton, Tooltip, Box
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { getExportFormats, exportModelByUpload } from "../../api";
import { API_URL } from "../../config";

export default function ExportModelPage() {
  const [formats, setFormats] = useState([]);
  const [schema, setSchema] = useState({});
  const [format, setFormat] = useState("onnx");

  const [file, setFile] = useState(null);

  const [options, setOptions] = useState({});
  const [showOptions, setShowOptions] = useState(true);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // lấy danh sách format + schema option
    getExportFormats()
      .then(r => {
        const d = r.data;
        setFormats(d.formats || []);
        setSchema(d.options_schema || {});
        // init default options cho ONNX lần đầu
        const def = d.options_schema?.onnx || {};
        const init = {};
        Object.entries(def).forEach(([k, meta]) => (init[k] = meta.default));
        setOptions(init);
      })
      .catch(e => setError(e.response?.data?.detail || e.message || String(e)));
  }, []);

  useEffect(() => {
    // khi đổi format: reset option theo default
    const def = schema?.[format] || {};
    const init = {};
    Object.entries(def).forEach(([k, meta]) => (init[k] = meta.default));
    setOptions(init);
  }, [format, schema]);

  const visibleOptions = useMemo(() => schema?.[format] || {}, [schema, format]);

  const onChangeOpt = (key, meta, raw) => {
    const value =
      meta.type === "int" ? Number(raw) :
      meta.type === "bool" ? Boolean(raw) :
      raw;
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const doUploadExport = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("format", format);
      form.append("options_json", JSON.stringify(options));
      const r = await exportModelByUpload(form);
      const data = r.data;
      if (data.ok === false) {
        throw new Error(data?.detail || data?.error || `Export failed.`);
      }
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadHref = result?.artifact
    ? `${API_URL}/export/download?path=${encodeURIComponent(result.artifact)}`
    : null;

  return (
    <Container maxWidth="lg" className="animate-fade-in delay-1" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box 
                sx={{ 
                    width: '4px', height: 32, 
                    borderRadius: 2, 
                    background: 'linear-gradient(to bottom, #ec4899, #8b5cf6)'
                }}
            />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Export Model
            </Typography>
        </Box>
        {busy && <LinearProgress sx={{ width: 240, borderRadius: 2 }} />}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Card: cấu hình chung */}
      <Card className="glass-card" elevation={0} sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="format-label">Định dạng</InputLabel>
                <Select
                  labelId="format-label"
                  label="Định dạng"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  {formats.map((f) => (
                    <MenuItem key={f} value={f}>
                      {f.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md="auto">
              <Button
                variant="outlined"
                startIcon={<TuneIcon />}
                endIcon={showOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setShowOptions(v => !v)}
                sx={{ height: 40 }}
              >
                {showOptions ? "Ẩn tuỳ chỉnh" : "Hiện tuỳ chỉnh"}
              </Button>
            </Grid>
          </Grid>

          {showOptions && (
            <>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                {Object.entries(visibleOptions).map(([k, meta]) => (
                  <Grid key={k} item xs={12} md={4}>
                    {meta.type === "bool" ? (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!options[k]}
                            onChange={(e) => onChangeOpt(k, meta, e.target.checked)}
                          />
                        }
                        label={
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <span>{meta.label}</span>
                            {meta.help && (
                              <Tooltip title={meta.help}>
                                <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        }
                      />
                    ) : (
                      <TextField
                        type="number"
                        fullWidth
                        label={meta.label}
                        value={options[k] ?? meta.default}
                        onChange={(e) => onChangeOpt(k, meta, e.target.value)}
                        helperText={meta.help || " "}
                      />
                    )}
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </CardContent>
      </Card>

      {/* Card: Upload & Export */}
      <Card className="glass-card" elevation={0} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Upload file .pt or .onnx và export
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
            >
              Select model file
              <input
                hidden
                type="file"
                accept=".pt,.onnx,.engine"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>

            <Typography variant="body2" sx={{ minHeight: 24 }}>
              {file ? `Selected: ${file.name}` : "No file selected"}
            </Typography>

            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={doUploadExport}
              disabled={!file || busy}
            >
              {busy ? "Exporting..." : "Export"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Card: Kết quả */}
      <Card className="glass-card" elevation={0}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Kết quả</Typography>
            {downloadHref && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                href={downloadHref}
              >
                Tải file đã export
              </Button>
            )}
          </Stack>

          <TextField
            fullWidth
            multiline
            minRows={6}
            value={JSON.stringify(result ?? {}, null, 2)}
            InputProps={{ readOnly: true, sx: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
          />
        </CardContent>
      </Card>

      {/* Gợi ý */}
      <Stack sx={{ mt: 2 }} spacing={0.5}>
        <Typography variant="body2">
          <b>Gợi ý:</b> <i>imgsz</i> nên trùng kích thước lúc train (ví dụ 224 cho classification, 640 cho detection).
        </Typography>
        <Typography variant="body2">
          Với ONNX, bạn có thể bật <i>Dynamic axes</i> để chấp nhận kích thước linh hoạt (tuỳ engine).
        </Typography>
      </Stack>
    </Container>
  );
}
