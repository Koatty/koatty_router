/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-10 15:04:26
 * @LastEditTime: 2021-12-13 16:52:36
 */
import path from "path";
import { LoadProto } from "koatty_proto";


const protoFile = path.resolve("./test/example.proto");

describe("protobuf", () => {
    test("LoadProto", async function () {
        const res = await LoadProto(protoFile);
        expect(res.length > 0).toEqual(true);
        console.log(res);

        expect(res[0].name).toEqual("Example1")
    });
});

