"""Parsing stubs for the BFR aero data ingestion pipeline.

No real parsing logic lives here yet -- see docs/post_zip_file_format_spec.md
for the file categories and open questions these modules are stubbed against.

Current scope: post_<job_name>.zip (per the Sabalcore naming convention) is
the only artifact type these parsers handle. Other formats (e.g. a future
CSV trials log) are a known extension point, not something to build
generic support for ahead of need -- see CONTRIBUTING.md.
"""
