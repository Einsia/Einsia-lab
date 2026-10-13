"""Compatibility entry point for the RoboDojo-only static asset exporter.

The previous RoboTwin/RoboCasa demonstration exporter has been retired.
Use export-robodojo.py --help for options. This is never invoked by builds.
"""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('export-robodojo.py')), run_name='__main__')
