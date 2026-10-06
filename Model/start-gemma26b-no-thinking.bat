@echo off
rem Gemma GM server for Expedition's Gate.
rem Model + llama.cpp are NOT copied here - this .bat links straight into
rem the Novel's_Model install to avoid duplicating ~16GB of GGUF.
title Gemma4-26B-A4B heretic (no thinking) - Expedition's Gate GM
echo =====================================================
echo  Gemma 4 26B A4B ultra-uncensored-heretic Q4_K_S
echo  26B total / 4B active MoE. Experts split
echo  GPU+RAM (VRAM ~6.3GB, RAM ~9GB).
echo  Context: 147,456 tokens (KV q8_0).
echo  Serves: http://127.0.0.1:8080  (LLAMA_URL default)
echo =====================================================
set "MODEL_ROOT=C:\Code\Novel's_Model\ai_model"
"%MODEL_ROOT%\llama.cpp\llama-server.exe" ^
  -m "%MODEL_ROOT%\Gemma4-26B-A4B-heretic_Q4_K_S\gemma-4-26B-A4B-it-ultra-uncensored-heretic-Q4_K_S.gguf" ^
  -ngl 99 ^
  --n-cpu-moe 24 ^
  -c 147456 ^
  -fa on ^
  --cache-type-k q8_0 ^
  --cache-type-v q8_0 ^
  --reasoning off ^
  --host 127.0.0.1 --port 8080
pause
