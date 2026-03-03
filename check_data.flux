from(bucket: "romii_bucket") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "drawworks") |> count()
