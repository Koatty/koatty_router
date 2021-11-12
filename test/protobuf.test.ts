/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-10 15:04:26
 * @LastEditTime: 2021-11-10 19:16:04
 */
import path from "path";
import { LoadProto } from "../src/grpc/protobuf";


const protoFile = path.resolve("./test/example.proto");

describe("protobuf", () => {
    test("LoadProto", async function () {
        const res = await LoadProto(protoFile);
        expect(res.length > 0).toEqual(true);
        console.log(res);

        expect(res[0].name).toEqual("Example1")
    });
});

