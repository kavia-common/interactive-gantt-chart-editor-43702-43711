#!/bin/bash
cd /home/kavia/workspace/code-generation/interactive-gantt-chart-editor-43702-43711/gantt_chart_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

