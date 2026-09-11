#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — cron defaults Ruby to US-ASCII. See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# probe-gbp-v4.rb
#
# Read-only health check for the Google Business Profile v4 API that
# post-events-to-google.rb depends on. Mints an access token from the saved
# refresh token, then does a GET localPosts.list against the legacy
# mybusiness.googleapis.com/v4 host — the endpoint that needs Google's
# "Basic API Access" approval. Makes NO writes.
#
# Use it to answer "is the API enabled / approved yet?":
#   ruby script/probe-gbp-v4.rb
#
# HTTP 200 on step [3] -> approved & working; go run post-events-to-google.rb.
# HTTP 403 PERMISSION_DENIED ("...has not been used in project... or it is
#   disabled") -> approval not granted yet (the legacy API stays invisible and
#   un-enableable until Google allowlists the project). Wait and re-run.
#
# Shares the same secrets as post-events-to-google.rb (gitignored):
#   client_secret_*.json (OAuth client), gbp-token.json (refresh token).

require "net/http"
require "uri"
require "json"

PROJECT_ROOT = File.expand_path("..", __dir__)
TOKEN_FILE   = ENV["GBP_TOKEN_FILE"] || File.join(PROJECT_ROOT, "gbp-token.json")
STATE_FILE   = File.join(ENV["GBP_DIR"] || File.join(PROJECT_ROOT, "gbp"), "gbp-state.json")

LOCATION_ID  = "18390205646696162099"   # the GBP location (from the setup guide)
V4_HOST      = "https://mybusiness.googleapis.com/v4"
ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"

def client_config
  path = Dir[File.join(PROJECT_ROOT, "client_secret_*.json")].first
  raise "No client_secret_*.json in #{PROJECT_ROOT}" unless path
  j = JSON.parse(File.read(path))
  j["installed"] || j["web"] || raise("Unexpected client secret shape in #{File.basename(path)}")
end

def http_post(url, form)
  uri = URI(url)
  req = Net::HTTP::Post.new(uri)
  req.set_form_data(form)
  resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  [resp.code.to_i, (JSON.parse(resp.body) rescue resp.body)]
end

def http_get(url, token)
  uri = URI(url)
  req = Net::HTTP::Get.new(uri)
  req["Authorization"] = "Bearer #{token}"
  resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  [resp.code.to_i, (JSON.parse(resp.body) rescue resp.body)]
end

# Account resource name — prefer the one cached in gbp-state.json, else accounts.list.
def account_name(token)
  state = (JSON.parse(File.read(STATE_FILE)) rescue {})
  cached = state.dig("_meta", "account")
  return cached if cached
  _, acc = http_get(ACCOUNTS_URL, token)
  (acc.is_a?(Hash) && (acc["accounts"] || []).first || {})["name"]
end

cfg = client_config
tok = JSON.parse(File.read(TOKEN_FILE))

# 1) Mint an access token from the saved refresh token.
code, t = http_post(cfg["token_uri"], {
  "client_id"     => cfg["client_id"],
  "client_secret" => cfg["client_secret"],
  "refresh_token" => tok["refresh_token"],
  "grant_type"    => "refresh_token"
})
abort "TOKEN REFRESH FAILED HTTP #{code}: #{t.inspect}" unless code == 200 && t["access_token"]
at = t["access_token"]
puts "[1] access token: OK"

# 2) accounts.list (Account Management v1 — usually enabled already).
code, _acc = http_get(ACCOUNTS_URL, at)
puts "[2] accounts.list (v1): HTTP #{code}"
account = account_name(at)
abort "    could not resolve account name (set GBP_ACCOUNT in gbp-state.json _meta)" unless account
puts "    account = #{account}"

# 3) THE TEST: v4 localPosts.list — the API gated behind Basic API Access approval.
code, lp = http_get("#{V4_HOST}/#{account}/locations/#{LOCATION_ID}/localPosts", at)
puts "[3] v4 localPosts.list: HTTP #{code}"
if code == 200
  puts "    ✅ v4 API ENABLED & WORKING. Existing posts: #{(lp["localPosts"] || []).size}"
  exit 0
else
  msg = lp.is_a?(Hash) ? "#{lp.dig("error", "status")} / #{lp.dig("error", "message")}" : lp.to_s
  puts "    ❌ NOT YET. #{msg[0, 400]}"
  exit 1
end
