import axios from "axios";
import * as dotenv from "dotenv";
import { writeFileSync } from "fs";

(async () => {
  dotenv.config();

  const { TENDERLY_USER, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY } = process.env;
  const TENDERLY_FORK_API = `http://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`;

  const opts = {
    headers: {
      "X-Access-Key": TENDERLY_ACCESS_KEY as string,
    },
  };
  const body = {
    network_id: "10",
  };

  const res = await axios.post(TENDERLY_FORK_API, body, opts);
  const forkURL = `https://rpc.tenderly.co/fork/${res.data.simulation_fork.id}`;

  writeFileSync("./tenderlyConfig.json", JSON.stringify({ forkURL }));
})();
