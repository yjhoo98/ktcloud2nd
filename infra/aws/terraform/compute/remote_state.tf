data "terraform_remote_state" "network" {
  backend = "s3"

  config = {
    bucket     = var.network_state_bucket
    key        = var.network_state_key
    region     = var.network_state_region
    access_key = var.network_state_access_key
    secret_key = var.network_state_secret_key
  }
}
